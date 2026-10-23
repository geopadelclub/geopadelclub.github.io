# © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización.
import json
import os
import sys
import tempfile
from pathlib import Path

import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.serialization import pkcs12
from lxml import etree

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CERT_PATH = Path(os.environ["VERIFACTU_CERT_PATH"])
CERT_PASSWORD = os.environ["VERIFACTU_CERT_PASSWORD"]
MODO = os.environ.get("VERIFACTU_MODO", "test")
IDS_JSON = os.environ.get("FACTURA_IDS_JSON", "")

AEAT_URL = {
    "test": "https://prewww2.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
    "prod": "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
}[MODO]

SB_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def sb_get(path, params=None):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=SB_HEADERS, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def sb_patch(path, body, params=None):
    headers = {**SB_HEADERS, "Prefer": "return=minimal"}
    r = requests.patch(f"{SUPABASE_URL}/rest/v1/{path}", headers=headers, json=body, params=params, timeout=30)
    r.raise_for_status()


def cargar_certificado_pem():
    p12 = pkcs12.load_key_and_certificates(
        CERT_PATH.read_bytes(),
        CERT_PASSWORD.encode() if CERT_PASSWORD else None,
    )
    key, cert, _ = p12
    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    combined = cert_pem + key_pem
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
    tmp.write(combined)
    tmp.close()
    return Path(tmp.name)


def ids_a_procesar():
    ids = []
    if IDS_JSON and IDS_JSON.strip() and IDS_JSON.strip() != "null":
        try:
            parsed = json.loads(IDS_JSON)
            if isinstance(parsed, list):
                ids = [str(i) for i in parsed if i]
        except json.JSONDecodeError:
            pass
    if ids:
        pendientes = sb_get("facturas", {
            "id": f"in.({','.join(ids)})",
            "enviada_aeat": "eq.false",
            "tipo": "eq.Factura",
        })
    else:
        pendientes = sb_get("facturas", {
            "enviada_aeat": "eq.false",
            "tipo": "eq.Factura",
            "order": "created_at.asc",
            "limit": "20",
        })
    return pendientes


def construir_registro_alta(factura, lineas, config):
    ns = {
        "sum": "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd",
    }
    raiz = etree.Element("{sum}RegistroAlta".replace("sum", ns["sum"]), nsmap=ns)

    def sub(padre, tag, texto):
        el = etree.SubElement(padre, f"{{{ns['sum']}}}{tag}")
        el.text = str(texto)
        return el

    sub(raiz, "IDVersion", "1.0")
    idf = etree.SubElement(raiz, f"{{{ns['sum']}}}IDFactura")
    emisor = etree.SubElement(idf, f"{{{ns['sum']}}}IDEmisorFactura")
    sub(emisor, "NIF", config["nif"])
    sub(idf, "NumSerieFactura", factura["numero"])
    fecha = factura["fecha"]
    y, m, d = fecha.split("-")
    sub(idf, "FechaExpedicionFactura", f"{d}-{m}-{y}")

    sub(raiz, "NombreRazonEmisor", config["nombre"])
    tipo = "F1" if not factura.get("factura_original_id") else "R4"
    sub(raiz, "TipoFactura", tipo)
    if factura.get("factura_original_id"):
        sub(raiz, "TipoRectificativa", "S")
        sub(raiz, "DescripcionOperacion", factura.get("motivo_rectificacion") or "Rectificación")
    else:
        sub(raiz, "DescripcionOperacion", "Servicios del club")

    desglose = etree.SubElement(raiz, f"{{{ns['sum']}}}Desglose")
    det = etree.SubElement(desglose, f"{{{ns['sum']}}}DetalleDesglose")
    sub(det, "Impuesto", "01")
    sub(det, "ClaveRegimen", "01")
    sub(det, "CalificacionOperacion", "S1")
    sub(det, "TipoImpositivo", f"{float(factura['iva_porcentaje']):.2f}")
    sub(det, "BaseImponibleOimporteNoSujeto", f"{float(factura['base_imponible']):.2f}")
    sub(det, "CuotaRepercutida", f"{float(factura['cuota_iva']):.2f}")

    sub(raiz, "CuotaTotal", f"{float(factura['cuota_iva']):.2f}")
    sub(raiz, "ImporteTotal", f"{float(factura['total']):.2f}")

    enc = etree.SubElement(raiz, f"{{{ns['sum']}}}Encadenamiento")
    if factura.get("hash_anterior"):
        ant = etree.SubElement(enc, f"{{{ns['sum']}}}RegistroAnterior")
        sub(ant, "IDEmisorFactura", config["nif"])
        sub(ant, "NumSerieFactura", factura.get("numero_anterior") or "")
        sub(ant, "FechaExpedicionFactura", factura.get("fecha_anterior") or "")
        sub(ant, "Huella", factura["hash_anterior"])
    else:
        sub(enc, "PrimerRegistro", "S")

    si = etree.SubElement(raiz, f"{{{ns['sum']}}}SistemaInformatico")
    sub(si, "NombreRazon", config["nombre"])
    sub(si, "NIF", config["nif"])
    sub(si, "NombreSistemaInformatico", "Geopadel")
    sub(si, "IdSistemaInformatico", "GP")
    sub(si, "Version", "1.0.0")
    sub(si, "NumeroInstalacion", "001")
    sub(si, "TipoUsoPosibleSoloVerifactu", "S")
    sub(si, "TipoUsoPosibleMultiOT", "N")
    sub(si, "IndicadoresMultiplesOT", "N")

    sub(raiz, "FechaHoraHusoGenRegistro", factura["created_at"])
    sub(raiz, "TipoHuella", "01")
    sub(raiz, "Huella", factura["hash_actual"])

    return raiz


def firmar_registro(registro):
    from signxml import XMLSigner, methods
    from cryptography.hazmat.primitives.serialization import load_pem_private_key

    p12 = pkcs12.load_key_and_certificates(
        CERT_PATH.read_bytes(),
        CERT_PASSWORD.encode() if CERT_PASSWORD else None,
    )
    key, cert, _ = p12

    signer = XMLSigner(
        method=methods.enveloped,
        signature_algorithm="rsa-sha256",
        digest_algorithm="sha256",
        c14n_algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    )
    return signer.sign(registro, key=key, cert=[cert])


def enviar_aeat(factura, lineas, config, cert_pem_path):
    registro = construir_registro_alta(factura, lineas, config)
    registro_firmado = firmar_registro(registro)

    nsmap = {
        "soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
        "sum1": "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd",
        "sum": "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd",
    }
    env = etree.Element("{soapenv}Envelope", nsmap=nsmap)
    body = etree.SubElement(env, "{soapenv}Body")
    reg = etree.SubElement(body, "{sum1}RegFactuSistemaFacturacion")

    cab = etree.SubElement(reg, "{sum1}Cabecera")
    obl = etree.SubElement(cab, "{sum}ObligadoEmision")
    etree.SubElement(obl, "{sum}NombreRazon").text = config["nombre"]
    etree.SubElement(obl, "{sum}NIF").text = config["nif"]

    reg_fact = etree.SubElement(reg, "{sum1}RegistroFactura")
    reg_fact.append(registro_firmado)

    xml_bytes = etree.tostring(env, xml_declaration=True, encoding="UTF-8")

    r = requests.post(
        AEAT_URL,
        data=xml_bytes,
        headers={
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": "",
        },
        cert=str(cert_pem_path),
        verify=True,
        timeout=60,
    )
    return r.status_code, r.text


def main():
    try:
        facturas = ids_a_procesar()
    except Exception as e:
        print(f"[ERROR] No se pudieron leer las facturas pendientes: {e}", file=sys.stderr)
        sys.exit(1)

    if not facturas:
        print("[INFO] No hay facturas pendientes.")
        return

    config_arr = sb_get("facturas_config", {"id": "eq.1"})
    if not config_arr:
        print("[ERROR] No hay fila en facturas_config", file=sys.stderr)
        sys.exit(1)
    config = config_arr[0]

    cert_pem_path = cargar_certificado_pem()
    fallos = 0

    for f in facturas:
        fid = f["id"]
        print(f"[INFO] Procesando {f['numero']} ({fid})")
        try:
            lineas = sb_get("factura_lineas", {"factura_id": f"eq.{fid}"})
            status, texto = enviar_aeat(f, lineas, config, cert_pem_path)

            if status == 200 and "Correct" in texto:
                sb_patch("facturas", {
                    "enviada_aeat": True,
                    "respuesta_aeat": texto[:2000],
                }, {"id": f"eq.{fid}"})
                print(f"[OK] {f['numero']} enviada")
            else:
                sb_patch("facturas", {
                    "respuesta_aeat": f"HTTP {status}: {texto[:1500]}",
                }, {"id": f"eq.{fid}"})
                print(f"[WARN] {f['numero']} no aceptada (HTTP {status})")
                fallos += 1
        except Exception as e:
            print(f"[ERROR] {f['numero']}: {e}", file=sys.stderr)
            fallos += 1

    cert_pem_path.unlink(missing_ok=True)

    if fallos:
        sys.exit(2)


if __name__ == "__main__":
    main()