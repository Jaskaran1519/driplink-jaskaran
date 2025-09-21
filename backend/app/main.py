from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .routes.videos import router as videos_router
from .services.storage import ensure_data_dirs, OUTPUT_ROOT
from fastapi.responses import HTMLResponse, Response


app = FastAPI(title="DripLink Render Backend", version="0.1.0")

# CORS (allow local dev frontends)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure storage dirs
ensure_data_dirs()

# Mount results as static to allow GET downloads
app.mount("/results", StaticFiles(directory=OUTPUT_ROOT), name="results")

# Routers
app.include_router(videos_router, prefix="/api", tags=["videos"]) 


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def root():
    return (
        """
        <html>
          <head><title>DripLink Render Backend</title></head>
          <body style="font-family: system-ui, sans-serif; padding: 20px;">
            <h2>DripLink Render Backend</h2>
            <ul>
              <li><a href="/docs">OpenAPI Docs</a></li>
              <li><a href="/health">Health</a></li>
            </ul>
          </body>
        </html>
        """
    )


@app.get("/favicon.ico")
def favicon():
    # no favicon; return empty 204
    return Response(status_code=204)
