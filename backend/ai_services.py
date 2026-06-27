import os
import json
import google.generativeai as genai
from typing import Dict, Any, List
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)
# Ensure GEMINI_API_KEY is in your .env or environment variables
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Use a fast model for text parsing and a vision model for images
TEXT_MODEL_NAME = "gemini-flash-latest"
VISION_MODEL_NAME = "gemini-flash-latest"

def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def parse_natural_language_expense(text: str, context_users: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parses a natural language string into a structured expense format using Gemini.
    """
    model = genai.GenerativeModel(TEXT_MODEL_NAME)
    
    prompt = f"""
    You are an AI assistant for an expense sharing app called SplitSmart.
    Extract the expense details from the following text and output ONLY valid JSON.
    
    Context (available users in this group):
    {json.dumps(context_users)}
    
    Rules:
    1. 'amount': The total amount paid (number).
    2. 'description': Short description of the expense.
    3. 'payer_id': The ID of the user who paid. Infer from context or assume user ID 1 if "I" is used.
    4. 'split_among_ids': List of user IDs involved in the split. Map names to IDs using the context. If "split with everyone", include all context users.
    5. 'split_type': Usually "equal".
    
    Input text: "{text}"
    
    Output JSON format:
    {{
        "amount": 480,
        "description": "Pizza",
        "payer_id": 1,
        "split_among_ids": [1, 2, 3],
        "split_type": "equal"
    }}
    """
    
    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            ),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        raise ValueError(f"Failed to parse Gemini response: {str(e)}")

def parse_audio_expense(audio_bytes: bytes, mime_type: str, context_users: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Parses an audio recording into a structured expense format using Gemini's native multimodal audio capabilities.
    """
    model = genai.GenerativeModel(TEXT_MODEL_NAME)
    
    prompt = f"""
    You are an AI assistant for an expense sharing app called SplitSmart.
    Listen to the attached audio recording and extract the expense details.
    The audio may be in English, Hindi, or Hinglish. Output ONLY valid JSON.
    
    Context (available users in this group):
    {json.dumps(context_users)}
    
    Rules:
    1. 'amount': The total amount paid (number).
    2. 'description': Short description of the expense.
    3. 'payer_id': The ID of the user who paid. Infer from context or assume user ID 1 if "I" is used.
    4. 'split_among_ids': List of user IDs involved in the split. Map names to IDs using the context. If "split with everyone", include all context users.
    5. 'split_type': Usually "equal".
    
    Output JSON format:
    {{
        "amount": 480,
        "description": "Pizza",
        "payer_id": 1,
        "split_among_ids": [1, 2, 3],
        "split_type": "equal"
    }}
    """
    
    try:
        response = model.generate_content(
            [
                {"mime_type": mime_type, "data": audio_bytes},
                prompt
            ],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            ),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        raise ValueError(f"Failed to parse audio using Gemini: {str(e)}")

def parse_bill_image(image_bytes: bytes, mime_type: str) -> Dict[str, Any]:
    """
    Parses a bill/receipt image to extract line items using Gemini Vision capabilities.
    """
    model = genai.GenerativeModel(VISION_MODEL_NAME)
    
    prompt = """
    Extract all line items from this bill/receipt. Output ONLY valid JSON.
    Include the item name, quantity, and total price for that item.
    Also include taxes, charges, and the grand total.
    
    Output JSON format:
    {
        "items": [
            {"name": "Margherita Pizza", "quantity": 1, "price": 250.0},
            {"name": "Coke", "quantity": 2, "price": 100.0}
        ],
        "taxes_and_charges": 50.0,
        "grand_total": 400.0,
        "restaurant_name": "Pizza Hut"
    }
    """
    
    image_part = {
        "mime_type": mime_type,
        "data": image_bytes
    }
    
    try:
        response = model.generate_content(
            [prompt, image_part],
            generation_config=genai.types.GenerationConfig(
                response_mime_type="application/json",
            ),
        )
        return json.loads(_clean_json(response.text))
    except Exception as e:
        raise ValueError(f"Failed to parse bill image using Gemini: {str(e)}")
