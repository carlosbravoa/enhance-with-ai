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
        
        this._entry.clutter_text.connect('activate', () => {
            this._runScript();
        });
        contentBox.add_child(this._entry);

        // 2. Result/Context Area
        // We need a ScrollView because the text area can grow very large
        const scrollView = new St.ScrollView({
            style_class: 'ai-helper-scrollview',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            enable_mouse_scrolling: true,
            x_expand: true,
            y_expand: true
        });

        // Define a fixed size for the scroll view window
        scrollView.set_width(450); 
        scrollView.set_height(350);

        // Container inside ScrollView
        const scrollContent = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            y_expand: true // Allow children to fill the viewport
        });

        // The Text Area (St.Entry acting as a text editor)
        this._resultEntry = new St.Entry({
            style_class: 'ai-helper-result-entry',
            x_expand: true,
            y_expand: true, // Fill the scrollview initially
            can_focus: true
        });

        // Apply the "TextArea" behavior (Scrolling, Multi-line, Cursor tracking)
        this._configureTextArea(this._resultEntry, scrollView);
        
        scrollContent.add_child(this._resultEntry);
        scrollView.set_child(scrollContent);
        contentBox.add_child(scrollView);

        // --- Buttons ---
        this.addButton({
            label: _('Cancel'),
            action: () => this.close(),
            key: Clutter.KEY_Escape
        });

        this.addButton({
            label: _('Clear'),
            action: () => this._resultEntry.set_text('')
        });

        this._runButton = this.addButton({
            label: _('Run'),
            action: () => this._runScript(),
            isDefault: true
        });
        
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

    /**
     * Configures an St.Entry to behave like a scrollable multi-line TextArea.
     * This is required because St/Clutter lacks a native TextArea component.
     */
    _configureTextArea(entry, scrollView) {
        const text = entry.clutter_text;

        // 1. Enable multi-line support
        text.set_single_line_mode(false);
        text.set_activatable(false); // Pressing Enter creates a new line, doesn't submit
        text.set_line_wrap(true);
        text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);

        // 2. Fix Mouse Wheel Scrolling
        // Clutter.Text consumes scroll events by default. We must catch them on the
        // text actor itself (the leaf node) and propagate them up to the ScrollView.
        text.connect('scroll-event', (actor, event) => {
            return Clutter.EVENT_PROPAGATE;
        });

        // 3. Fix Cursor Visibility (Auto-scroll to cursor)
        // St.ScrollView does not automatically scroll to keep the cursor in view 
        // when navigating with keyboard inside a Clutter.Text. We must calculate manual offsets.
        text.connect('notify::cursor-position', () => {
            const cursorPos = text.get_cursor_position();
            const [success, x, y, lineHeight] = text.position_to_coords(cursorPos);
            
            if (success) {
                const adjustment = scrollView.vscroll.adjustment;
                const currentScroll = adjustment.value;
                const viewHeight = adjustment.page_size;

                if (y + lineHeight > currentScroll + viewHeight) {
                    adjustment.value = (y + lineHeight) - viewHeight; // Scroll Down
                } else if (y < currentScroll) {
                    adjustment.value = y; // Scroll Up
                }
            }
        });
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

        this._runButton.reactive = false;
        this._runButton.set_label(_('Processing...'));
        this._entry.reactive = false;
        this._resultEntry.set_text(_('Thinking...'));
        this._copyButton.visible = false;

        try {
            const scriptPath = GLib.build_filenamev([this._extensionPath, 'main.py']);
            const payload = JSON.stringify({ instruction: instruction, text: content });

            const proc = new Gio.Subprocess({
                argv: ['python3', scriptPath],
                flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            });

            proc.init(null);

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
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        const label = new St.Label({
            text: '✨',
            y_align: Clutter.ActorAlign.CENTER
        });
        this._indicator.add_child(label);

        this._indicator.connect('button-press-event', () => {
            this._openDialog();
            return Clutter.EVENT_STOP;
        });

        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    _openDialog() {
        const dialog = new HelperDialog(this.path);
        dialog.open();
    }
}
