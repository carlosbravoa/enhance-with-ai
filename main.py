#!/usr/bin/env python3
import sys
import json
import os
from pathlib import Path
from openai import OpenAI

CONFIG_DIR = Path.home() / ".config" / "enhance-with-ai-extension"
CONFIG_FILE = CONFIG_DIR / "config"


def load_api_key():
    """
    Loads the OpenAI API key from ~/.config/enhance-with-ai-extension/config

    If the file does not exist, it is created with instructions
    and an exception is raised.
    """
    if not CONFIG_FILE.exists():
        # Create directory if needed
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        # Create config file template
        CONFIG_FILE.write_text(
            "# Enhance With AI – configuration file\n"
            "# Add your OpenAI API key below and save the file\n\n"
            "OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx\n"
        )

        raise RuntimeError(
            f"OpenAI API key not found.\n\n"
            f"A configuration file has been created at:\n"
            f"  {CONFIG_FILE}\n\n"
            f"Please edit this file, add your OpenAI API key, and try again."
        )

    # Read config file
    for line in CONFIG_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("OPENAI_API_KEY="):
            key = line.split("=", 1)[1].strip()
            if key and not key.startswith("sk-xxxxxxxx"):
                return key

    raise RuntimeError(
        f"No valid OPENAI_API_KEY found in {CONFIG_FILE}\n"
        f"Please add a line like:\n"
        f"OPENAI_API_KEY=sk-..."
    )


def main():
    try:
        api_key = load_api_key()
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=api_key)

    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
        instruction = data.get("instruction", "")
        text = data.get("text", "")
        prompt = f"{instruction}\n\n{text}".strip()
    except Exception:
        # fallback if testing manually
        prompt = "Tell me the joke of the day"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.choices[0].message.content
    print(content)


if __name__ == "__main__":
    main()
