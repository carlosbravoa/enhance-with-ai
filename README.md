# Enhance With AI — GNOME Shell Extension

Adds a panel button that enhances the clipboard text using OpenAI.

## Installation

Copy the extension into your GNOME extensions directory:
The name of the folder containing the extension has to match the UUID inside the metadata file
In this case, the extension is called enhance-with-ai@cabra.cl but feel free to change it to 
whatever makes you happy :)  - Just make sure it contains `@something` at the end.

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/
cp -r enhance-with-ai ~/.local/share/gnome-shell/extensions/enhance-with-ai@cabra.cl
```

Restart GNOME Shell by logging out and in again and enable the extension:

```
gnome-extensions enable enhance-with-ai@cabra.cl
```

## Requirements

- Python 3.10+
- The openai Python package `pip install openai` (If you are on Ubuntu 24.04 or later, `apt install python3-openai`
- A valid OpenAI API key

## Setting your OpenAI API key

The helper script (`main.py`) reads the API key from `~/.config/enhance-with-ai-extension/config`
But it will create it for you on the first run. After the config file has been created, feel free to
edit it with any text editor and add your own API Key there (sk-XXX)


## Usage

Copy any text into your clipboard.

Click the “Enhance with AI” button in the GNOME Shell top bar.

Enter an instruction (e.g., “improve writing”, “summarize”, etc.).

Receive the result in a dialog and optionally copy it back to the clipboard.

