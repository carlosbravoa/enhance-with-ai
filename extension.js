import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const HelperDialog = GObject.registerClass({
    GTypeName: 'AiHelperDialog'
}, class HelperDialog extends ModalDialog.ModalDialog {
    constructor(extensionPath) {
        super({
            styleClass: 'ai-helper-dialog',
            destroyOnClose: true
        });

        this._extensionPath = extensionPath;

        // --- Layout Content ---
        const contentBox = new St.BoxLayout({
            vertical: true,
            style_class: 'ai-helper-content-box',
            x_expand: true,
            y_expand: true
        });
        this.contentLayout.add_child(contentBox);

        // 0. Title
        const titleLabel = new St.Label({
            text: _('Enhance with AI'),
            style_class: 'ai-helper-title',
            style: 'font-weight: bold; font-size: 13pt; padding-bottom: 10px;',
            x_align: Clutter.ActorAlign.CENTER
        });
        contentBox.add_child(titleLabel);

        // 1. Instruction Entry
        this._entry = new St.Entry({
            hint_text: _('Enter instruction (e.g., Summarize, Proofread, Explain)...'),
            style_class: 'ai-helper-entry',
            can_focus: true,
            x_expand: true
        });
        
        // Allow pressing Enter to submit
        this._entry.clutter_text.connect('activate', () => {
            this._runScript();
        });
        contentBox.add_child(this._entry);

        // 2. Result/Context Area (Scrollable + Editable)
        const scrollView = new St.ScrollView({
            style_class: 'ai-helper-scrollview',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            enable_mouse_scrolling: true,
            x_expand: true,
            y_expand: true
        });

        // Set a minimum size to prevent allocation errors
        scrollView.set_width(400); 
        scrollView.set_height(300);

        // Wrapper Box for the Entry
        const scrollContent = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true
        });

        // Use St.Entry (Multi-line) instead of St.Label
        this._resultEntry = new St.Entry({
            style_class: 'ai-helper-result-entry',
            x_expand: true,
            y_expand: true,
            can_focus: true
        });

        // Propagate scroll events to allow the parent ScrollView to handle scrolling
        this._resultEntry.connect('scroll-event', () => {
            return Clutter.EVENT_PROPAGATE;
        });

        // Configure underlying Clutter.Text for multi-line support
        const text = this._resultEntry.clutter_text;
        text.set_single_line_mode(false);
        text.set_activatable(false); // Enter key inserts newline instead of activating
        text.set_line_wrap(true);
        text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        
        scrollContent.add_child(this._resultEntry);
        scrollView.set_child(scrollContent);
        
        contentBox.add_child(scrollView);

        // --- Buttons ---
        
        // Cancel Button
        this.addButton({
            label: _('Cancel'),
            action: () => this.close(),
            key: Clutter.KEY_Escape
        });

        // Clear Button
        this.addButton({
            label: _('Clear'),
            action: () => this._resultEntry.set_text('')
        });

        // Run Button
        this._runButton = this.addButton({
            label: _('Run'),
            action: () => this._runScript(),
            isDefault: true
        });
        
        // Copy Button (Hidden initially)
        this._copyButton = this.addButton({
            label: _('Copy Result'),
            action: () => this._copyResult()
        });
        this._copyButton.visible = false;

        // Initialize Clipboard safely
        try {
            this._getClipboardContent();
        } catch (e) {
            console.error(e);
            this._resultEntry.set_text(_('Error accessing clipboard.'));
        }
    }

    _getClipboardContent() {
        const clipboard = St.Clipboard.get_default();
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
            if (text) {
                this._resultEntry.set_text(text);
            } else {
                this._resultEntry.set_hint_text(_('Clipboard is empty.'));
            }
        });
    }

    async _runScript() {
        const instruction = this._entry.get_text();
        const content = this._resultEntry.get_text();

        if (!instruction && !content) {
            this._resultEntry.set_text(_('Error: Missing instruction or content.'));
            return;
        }

        // UI Loading State
        this._runButton.reactive = false;
        this._runButton.set_label(_('Processing...'));
        this._entry.reactive = false;
        
        // Show status in the text box (overwriting input)
        this._resultEntry.set_text(_('Thinking...'));
        
        this._copyButton.visible = false;

        try {
            const scriptPath = GLib.build_filenamev([this._extensionPath, 'main.py']);
            
            const payload = JSON.stringify({
                instruction: instruction,
                text: content
            });

            // Launch Subprocess
            const proc = new Gio.Subprocess({
                argv: ['python3', scriptPath],
                flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });

            proc.init(null);

            // Write to stdin and read stdout/stderr
            const [stdout, stderr] = await new Promise((resolve, reject) => {
                proc.communicate_utf8_async(payload, null, (p, res) => {
                    try {
                        const [ok, out, err] = p.communicate_utf8_finish(res);
                        if (ok) {
                            resolve([out, err]);
                        } else {
                            reject(new Error("Subprocess communication failed"));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            if (proc.get_successful()) {
                const output = stdout ? stdout.trim() : "";
                this._resultEntry.set_text(output);
                this._copyButton.visible = true;
                this._copyButton.grab_key_focus();
            } else {
                console.error(stderr);
                this._resultEntry.set_text(`Error: ${stderr}`);
            }

        } catch (e) {
            this._resultEntry.set_text(`System Error: ${e.message}`);
            console.error(e);
        } finally {
            // Restore UI state
            if (this._runButton) {
                this._runButton.reactive = true;
                this._runButton.set_label(_('Run'));
            }
            if (this._entry) {
                this._entry.reactive = true;
            }
        }
    }

    _copyResult() {
        // Copy current contents of the entry (in case user edited the result)
        const text = this._resultEntry.get_text();
        if (text) {
            const clipboard = St.Clipboard.get_default();
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
            this.close();
        }
    }
});

export default class AiHelperExtension extends Extension {
    enable() {
        // Create the Top Bar Button
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // Add Text Icon "✨"
        const label = new St.Label({
            text: '✨',
            y_align: Clutter.ActorAlign.CENTER
        });
        this._indicator.add_child(label);

        // Handle Click
        this._indicator.connect('button-press-event', () => {
            this._openDialog();
            return Clutter.EVENT_STOP;
        });

        // Add to Status Area (Right side)
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    _openDialog() {
        console.debug("AI Helper: Icon clicked, opening dialog...");
        const dialog = new HelperDialog(this.path);
        dialog.open();
    }
}
