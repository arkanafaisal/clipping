import sys
import os
import json
import importlib
import traceback

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)


def setup_paths(custom_root_path: str = None) -> dict:
    """
    Mendaftarkan folder scripts dan libs dari shared storage secara dinamis ke sys.path.
    Prioritas pencarian (index 0) diberikan ke folder shared storage agar skrip luar
    bisa langsung menimpa skrip bawaan tanpa perlu build ulang APK.
    """
    added_paths = []
    if custom_root_path and os.path.exists(custom_root_path):
        scripts_dir = os.path.join(custom_root_path, "scripts")
        libs_dir = os.path.join(custom_root_path, "libs")

        if os.path.exists(scripts_dir) and scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)
            added_paths.append(scripts_dir)

        if os.path.exists(libs_dir):
            if libs_dir not in sys.path:
                sys.path.insert(0, libs_dir)
                added_paths.append(libs_dir)
            # Dukung file .whl atau .zip di dalam folder libs
            for fname in os.listdir(libs_dir):
                if fname.endswith((".whl", ".zip")):
                    wheel_path = os.path.join(libs_dir, fname)
                    if wheel_path not in sys.path:
                        sys.path.insert(0, wheel_path)
                        added_paths.append(wheel_path)

    return {
        "status": "success",
        "added_paths": added_paths,
        "sys_path": sys.path[:5]
    }


def execute_function(module_name: str, func_name: str, args_json: str = "{}") -> str:
    """
    Eksekutor skrip dinamis berbasis fungsi.
    Menerima nama modul, nama fungsi, dan argumen JSON dari Kotlin/JavaScript.
    Mengembalikan string JSON dengan format standar:
    { "status": "success", "data": ... } atau { "status": "error", "code": ..., "error": ... }
    """
    try:
        kwargs = json.loads(args_json) if args_json else {}

        # Import atau reload modul secara dinamis
        if module_name in sys.modules:
            mod = importlib.reload(sys.modules[module_name])
        else:
            mod = importlib.import_module(module_name)

        if not hasattr(mod, func_name):
            return json.dumps({
                "status": "error",
                "code": "FUNCTION_NOT_FOUND",
                "error": f"Fungsi '{func_name}' tidak ditemukan di modul '{module_name}'."
            })

        target_func = getattr(mod, func_name)
        result = target_func(**kwargs)

        if isinstance(result, str):
            # Jika hasil sudah berupa string JSON terformat, kembalikan langsung
            try:
                json.loads(result)
                return result
            except Exception:
                pass

        return json.dumps({
            "status": "success",
            "data": result
        })

    except Exception as e:
        full_trace = traceback.format_exc()
        return json.dumps({
            "status": "error",
            "code": "EXECUTION_ERROR",
            "error": str(e),
            "traceback": full_trace
        })
