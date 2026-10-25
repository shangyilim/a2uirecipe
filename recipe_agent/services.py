"""ADK custom services configuration for recipe_agent.

Mounts static directory for recipe images on the FastAPI application.
"""

import os
from fastapi.staticfiles import StaticFiles
import google.adk.cli.api_server as adk_api_server

_orig_get_fast_api_app = adk_api_server.ApiServer.get_fast_api_app

def _custom_get_fast_api_app(self, *args, **kwargs):
    app = _orig_get_fast_api_app(self, *args, **kwargs)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    images_dir = os.path.join(base_dir, "images")
    if not os.path.exists(images_dir):
        images_dir = os.path.join(base_dir, "recipe_agent", "images")
    if os.path.exists(images_dir):
        app.mount("/images", StaticFiles(directory=images_dir), name="recipe_images")
    return app

if getattr(adk_api_server.ApiServer, "_has_custom_images_mount", False) is False:
    adk_api_server.ApiServer.get_fast_api_app = _custom_get_fast_api_app
    adk_api_server.ApiServer._has_custom_images_mount = True
