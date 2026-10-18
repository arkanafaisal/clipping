import os
import re
import traceback
import requests

def download_gdrive_public_file(file_id: str, output_path: str, config: dict = None) -> dict:
    """
    Mengunduh file publik dari Google Drive tanpa autentikasi secara dinamis dan pass-through murni.
    Seluruh konfigurasi (URL templates, headers, timeout) dikirim secara dinamis oleh frontend.

    Returns:
        dict: { status: 'success', output_path, file_size, code: 'SUCCESS' }
              atau { status: 'error', code, error, traceback }
    """
    if not file_id or not output_path:
        return {
            "status": "error",
            "code": "INVALID_PARAMS",
            "error": "Parameter 'file_id' dan 'output_path' wajib disertakan.",
            "traceback": ""
        }

    output_dir = os.path.dirname(output_path)
    if output_dir:
        try:
            os.makedirs(output_dir, exist_ok=True)
        except Exception as e:
            return {
                "status": "error",
                "code": "STORAGE_PERMISSION_DENIED",
                "error": f"Gagal membuat direktori tujuan '{output_dir}': {str(e)}",
                "traceback": traceback.format_exc()
            }

    cfg = config or {}
    timeout = cfg.get("timeout", 30)
    headers = cfg.get("headers") or {}
    url_templates = cfg.get("urlTemplates") or [
        "https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0&confirm=t",
        "https://drive.google.com/uc?export=download&id={file_id}&confirm=t",
        "https://drive.google.com/uc?id={file_id}&export=download",
    ]

    session = requests.Session()
    if headers:
        session.headers.update(headers)

    urls_to_try = [tpl.replace("{file_id}", file_id) for tpl in url_templates]
    res = None
    last_req_error = None

    for u in urls_to_try:
        try:
            temp_res = session.get(u, stream=True, timeout=timeout)
            if temp_res.status_code == 200:
                res = temp_res
                break
            else:
                last_req_error = f"HTTP {temp_res.status_code} dari {u}"
        except Exception as e_req:
            last_req_error = str(e_req)
            continue

    if not res or res.status_code != 200:
        return {
            "status": "error",
            "code": "GDRIVE_DOWNLOAD_FAILED",
            "error": last_req_error or "Gagal menghubungi server Google Drive untuk mengunduh file.",
            "traceback": last_req_error or ""
        }

    # Cek jika respons awal adalah halaman HTML konfirmasi virus scan Google
    content_type = res.headers.get("Content-Type", "")
    if "text/html" in content_type:
        confirm_token = None
        for k, v in session.cookies.items():
            if k.startswith("download_warning"):
                confirm_token = v
                break
        if not confirm_token:
            match = re.search(r'confirm=([0-9A-Za-z_]+)', res.text)
            if match:
                confirm_token = match.group(1)

        if confirm_token:
            confirm_url = f"https://drive.google.com/uc?export=download&id={file_id}&confirm={confirm_token}"
            try:
                res = session.get(confirm_url, stream=True, timeout=timeout)
            except Exception as e_conf:
                return {
                    "status": "error",
                    "code": "GDRIVE_DOWNLOAD_FAILED",
                    "error": f"Gagal mengonfirmasi unduhan Google Drive: {str(e_conf)}",
                    "traceback": traceback.format_exc()
                }

    try:
        with open(output_path, "wb") as f:
            for chunk in res.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
    except Exception as e_write:
        return {
            "status": "error",
            "code": "STORAGE_PERMISSION_DENIED" if "permission" in str(e_write).lower() else "GDRIVE_DOWNLOAD_FAILED",
            "error": f"Gagal menulis file ke '{output_path}': {str(e_write)}",
            "traceback": traceback.format_exc()
        }

    if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        return {
            "status": "error",
            "code": "GDRIVE_FILE_EMPTY",
            "error": f"File hasil unduhan di '{output_path}' kosong atau tidak tersimpan.",
            "traceback": ""
        }

    # Validasi isi file: pastikan bukan halaman HTML (misal preview folder atau halaman login)
    try:
        with open(output_path, "rb") as f:
            header_sample = f.read(512).decode('utf-8', errors='ignore').strip()
            if header_sample.startswith("<!DOCTYPE html") or header_sample.startswith("<html"):
                try:
                    os.remove(output_path)
                except Exception:
                    pass
                return {
                    "status": "error",
                    "code": "GDRIVE_HTML_CONTENT",
                    "error": "Link Google Drive yang dimasukkan mengarah ke halaman HTML atau Folder, bukan file cookies.txt.",
                    "traceback": ""
                }
    except Exception:
        pass

    file_size = os.path.getsize(output_path)
    return {
        "status": "success",
        "code": "SUCCESS",
        "output_path": output_path,
        "file_size": file_size
    }
