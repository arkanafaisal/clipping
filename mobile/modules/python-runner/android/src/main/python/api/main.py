from server import (
    app,
    get_stream,
    download_to_gdrive,
    get_active_gdrive_tasks,
    proxy_stream,
    get_heatmap,
    start_server,
)

if __name__ == "__main__":
    start_server()
