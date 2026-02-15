#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "huggingface_hub",
# ]
# ///
import json
import os
import sys
import argparse
from huggingface_hub import InferenceClient

def parse_args():
    parser = argparse.ArgumentParser(description="Focus Timer Bot AI Parser")
    parser.add_argument("text", help="The natural language command to parse")
    parser.add_argument("--model", default="Qwen/Qwen2.5-7B-Instruct", help="HF model to use")
    return parser.parse_args()

def main():
    args = parse_args()

    token = os.environ.get("HF_TOKEN")
    if not token:
        print(json.dumps({"error": "HF_TOKEN not set"}))
        sys.exit(1)

    client = InferenceClient(api_key=token)

    system_prompt = """You are a natural language parser for a Focus Timer Bot.
Your task is to convert user requests into a JSON object with the following fields:
- task: string (e.g., "focus", "deep work", "study")
- duration: integer (minutes)
- start_time: string (e.g., "now", "14:00", "HH:MM")

Examples:
User: I want to focus for 30 minutes at 3pm
Assistant: {"task": "focus", "duration": 30, "start_time": "15:00"}

User: Book a deep work session for 1 hour starting now
Assistant: {"task": "deep work", "duration": 60, "start_time": "now"}

Respond ONLY with the JSON object."""

    try:
        response = client.chat.completions.create(
            model=args.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": args.text}
            ],
            max_tokens=100,
            response_format={"type": "json_object"}
        )
        print(response.choices[0].message.content)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
