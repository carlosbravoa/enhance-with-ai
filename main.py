#!/usr/bin/env python3
import sys
import json
from pathlib import Path
from openai import OpenAI

CONFIG_DIR = Path.home() / ".config" / "enhance-with-ai"
CONFIG_FILE = CONFIG_DIR / "config"

DEFAULT_MODEL = "gpt-4o-mini"


def load_config():
    """
    Loads API key and model from config file.
    Creates the config file with instructions on first run.
    """
    if not CONFIG_FILE.exists():
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        CONFIG_FILE.write_text(
            "# Enhance With AI – configuration file\n"
            "# Add your OpenAI API key below\n\n"
            "OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx\n\n"
            "# Optional model configuration\n"
            f"MODEL={DEFAULT_MODEL}\n"
        )

        raise RuntimeError(
            f"Configuration file not found.\n\n"
            f"A new one has been created at:\n"
            f"  {CONFIG_FILE}\n\n"
            f"Please edit it, add your OpenAI API key, and try again."
        )

    api_key = None
    model = DEFAULT_MODEL

    for line in CONFIG_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("OPENAI_API_KEY="):
            api_key = line.split("=", 1)[1].strip()

        elif line.startswith("MODEL="):
            model = line.split("=", 1)[1].strip() or DEFAULT_MODEL

    if not api_key or api_key.startswith("sk-xxxxxxxx"):
        raise RuntimeError(
            f"No valid OPENAI_API_KEY found in {CONFIG_FILE}\n"
            f"Please set:\n"
            f"OPENAI_API_KEY=sk-..."
        )

    return api_key, model


def main():
    try:
        api_key, model = load_config()
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
        prompt = "Tell me the joke of the day"

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}]
    )

    content = response.choices[0].message.content
    print(content)


if __name__ == "__main__":
    main()

