from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .routers import users, groups, expenses, chat, ai, auth
from .database import engine, get_db

# Create database tables
models.Base.metadata.create_all(bind=engine)


app = FastAPI(title="SplitSmart API", description="AI-powered expense sharing platform for students")

# Set up CORS
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(users.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(ai.router)
app.include_router(auth.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to SplitSmart API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
