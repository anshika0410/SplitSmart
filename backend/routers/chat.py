import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []

class ChatResponse(BaseModel):
    reply: str

# Use the environment variable for Gemini API Key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

system_instruction = """
You are the SplitSmart AI Help Assistant. You help users understand and use the SplitSmart app.
Features of SplitSmart include:
- Smart Split (splitting bills optimally)
- Bill Scan (scanning receipts with AI)
- Voice Split (using voice to split expenses)
- Hostel Mode (recurring expenses like rent, wifi)
- UPI integration (one-tap payments)
- Group Management (creating, archiving, adding members)
- Balances (You Owe, You Are Owed, Net Balance)

Rules:
1. Answer ONLY questions related to SplitSmart features, expense sharing, finances, or the app usage.
2. If the user asks something completely unrelated (e.g. "What is the capital of France?", "Write a poem"), politely decline and remind them you are a SplitSmart assistant.
3. Keep answers concise, friendly, and helpful. Use emojis.
4. You are an expert on the features listed above.
"""

@router.post("/help", response_model=ChatResponse)
def chat_with_bot(request: ChatRequest):
    if not GEMINI_API_KEY:
        return ChatResponse(reply="API Key missing. Please ask your administrator to configure GEMINI_API_KEY in the backend.")

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        # Convert history
        formatted_history = []
        for msg in request.history:
            role = "user" if msg.get("role") == "user" else "model"
            formatted_history.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg.get("content", ""))])
            )
            
        chat = client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3
            ),
            history=formatted_history
        )
        
        response = chat.send_message(request.message)
        return ChatResponse(reply=response.text)
        
    except Exception as e:
        print(f"Chat API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to communicate with AI service.")
