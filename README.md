# Enhance With AI — GNOME Shell Extension

Adds a panel button that enhances the clipboard text using OpenAI.

## Installation

Copy the extension into your GNOME extensions directory:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/
cp -r enhance-with-ai@carlos ~/.local/share/gnome-shell/extensions/

Restart GNOME Shell:

- Press Alt+F2
- Enter: r
- Press Enter

Enable the extension:

```
gnome-extensions enable enhance-with-ai@carlos
```

## Requirements

- Python 3.10+
- The openai Python package `pip install openai`
- A valid OpenAI API key

### Setting your OpenAI API key

The helper script (`ai-helper.py`) reads the API key from the `OPENAI_API_KEY` environment variable.

Add it permanently to your shell environment by editing `~/.bashrc` or `~/.profile`:

```
export OPENAI_API_KEY="your_api_key_here"
```

Then reload your shell:

```
source ~/.bashrc
```
Or log out and log back in.

### Alternative: Store the key in a config file

You may prefer not to export environment variables system-wide.
You can instead store the key in a file, for example:

```
~/.config/openai/key
```

Put your key inside:

```
sk-xxxxx
```

And modify `ai-helper.py` to load it manually:

```
import os
import pathlib

key_file = pathlib.Path("~/.config/openai/key").expanduser()
if key_file.exists():
    os.environ["OPENAI_API_KEY"] = key_file.read_text().strip()

```

This keeps your environment cleaner and your key separate.

## Usage

Copy any text into your clipboard.

Click the “Enhance with AI” button in the GNOME Shell top bar.

Enter an instruction (e.g., “improve writing”, “summarize”, etc.).

Receive the result in a dialog and optionally copy it back to the clipboard.

