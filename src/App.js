import React, { Component } from "react";
import PinchZoomPan from "react-responsive-pinch-zoom-pan";
import cx from "clsx";
import Popup from "reactjs-popup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen, faChevronLeft, faChevronRight, faEllipsisV, faKeyboard, faSpinner, faTimes } from "@fortawesome/free-solid-svg-icons";

import styles from "./App.module.scss";
import Keyboard from "./Keyboard";
import layouts from "./layouts.js";

const scriptFont = {
  "bali": {
    "fonts": ["Kadiri","Pustaka_Bali","Vimala"],
    "default": "Vimala"
  }
};
for (const script in scriptFont) {
  scriptFont[script].fonts = scriptFont[script].fonts.map(x => [x, x.replace(/_/g," ")]);
}

const platform = detectPlatform();
const getSelection = detectGetSelection();

viewportFix();

function detectPlatform() {
  const ua = window.navigator.userAgent;
  const platform = {};
  platform.iOS = ua.match(/iPhone|iPod|iPad/);
  platform.iOSSafari = platform.iOS && ua.match(/WebKit/) && !ua.match(/CriOS/);
  platform.mobile = platform.iOS || ua.match(/Android/);
  return platform;
}

function detectGetSelection() {
  if (platform.iOS) {
    if (document.caretRangeFromPoint) {
      return e => {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        return range && range.collapsed
          && { node: range.commonAncestorContainer, caretPos: range.startOffset };
      };
    }
  } else {
    if (window.getSelection) {
      return () => {
        const sel = window.getSelection();
        return sel.anchorNode && sel.isCollapsed
          && { node: sel.anchorNode, caretPos: sel.anchorOffset };
      };
    }
  }
}

function viewportFix() {
  if (platform.mobile) {
    const getVhPx = () => {
      const height = document.documentElement.clientHeight;
      return (height * 0.01) + "px";
    };

    document.documentElement.style.setProperty("--vh", getVhPx());
    window.addEventListener("resize", () => {
      document.documentElement.style.setProperty("--vh", getVhPx());
    });
  }
}

function blockPinchZoom(e) {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}

// function blockTapZoom(e) {
//   e.preventDefault();
//   e.target.click();
// }

const MenuItem = props => {
  const { label, className, spanClassName, close, onClick } = props;
  return (
    <div
      className={cx(styles.menuItem,className)}
      onClick={e => { close(); onClick && onClick(e); }}
    >{spanClassName && <span className={spanClassName}></span>}{label}</div>
  );
};

export default class App extends Component {
  constructor(props) {
    super(props);
    const { script } = props;
    this.editMode = props.mode === "edit";

    this.state = {
      archiveItem: props.archiveItem,
      transliteration: "",
      transliterationOpen: false,
      imageLoading: false,
    };

    const savedFont = window.localStorage.getItem(`font-${script}`);
    if (scriptFont[script] && scriptFont[script].fonts.some(([name]) => name === savedFont)) {
      this.state.font = savedFont;
    }

    if (!this.state.font) {
      this.state.font = scriptFont[script]
        ? scriptFont[script].default
        : "defaultFont";
    }

    if (this.editMode) {
      this.caretRef = React.createRef();
      this.textAreaRef = React.createRef();

      this.state = {
        ...this.state,
        open: true,
        imageUrl: props.imageUrl,
        iiifDimensions: props.iiifDimensions,
        keyboardAvailable: !!layouts[script],
      };
      this.state.keyboardOpen = this.state.keyboardAvailable && !(window.localStorage.getItem(`keyboardOpen-${script}`) === "false");
      this.state.emulateTextEdit = platform.mobile && this.state.keyboardOpen;
    } else {
      this.leafContents = [];
      this.state = {
        ...this.state,
        imageUrl: this.getLeafImageUrl(this.state.archiveItem.leaf),
        text: null,
        open: false,
        iiifDimensions: this.getIiifDimensions(this.state.archiveItem.leaf),
        keyboardOpen: false,
        emulateTextEdit: false,
      };
    }

    if (this.state.open) {
      this.state = { ...this.state, ...this.finalizeOpen() };
    }

    /*if (scriptFont[script]) {
      document.body.style.setProperty("font-family", `"${scriptFont[script].default}", ${window.getComputedStyle(document.body).getPropertyValue("font-family")}`);
    }*/
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.editMode && this.state.open) {
      if (this.state.keyboardOpen &&
        (this.state.caretPos !== prevState.caretPos || this.state.text !== prevState.text))
      {
        this.updateCaret();
      } else {
        this.focusTextArea();
      }
    }
  }

  handleOpen = async () => {
    const newState = { open: true, ...this.finalizeOpen() };
    if (this.state.text === null) {
      newState.text = await this.getLeafContents(this.state.archiveItem.leaf);
    }
    this.setState(newState);
  }

  finalizeOpen() {
    if (platform.iOSSafari) {
      document.addEventListener("touchmove", blockPinchZoom, { passive: false });
      //document.addEventListener("touchend", blockTapZoom, { passive: false });
    }
    document.body.classList.add(styles.noscroll);
    document.addEventListener("keydown", this.handleKeyDown);

    return this.finalizeState();
  }

  finalizeState(archiveItem) {
    const newState = {};

    if (archiveItem) {
      newState.archiveItem = archiveItem;
    } else {
      archiveItem = this.state.archiveItem;
    }

    newState.archiveItemKey = [archiveItem.id, archiveItem.file, archiveItem.leaf].join("$");
    if (this.props.iiifBaseUrl) {
      newState.iiifUrl = `${this.props.iiifBaseUrl}/${archiveItem.id}:${archiveItem.file}%24${archiveItem.leaf}`;
    }

    if (this.editMode) {
      const text = this.props.textbox.value.replace(/ *<br(?: *\/ *)?> *\n*/g, '\n').trim();
      setTimeout(() => this.checkStoredText(text), 1000);
      newState.text = text;
      newState.caretPos = text.length;
    }

    return newState;
  }

  handleClose = () => {
    if (platform.iOSSafari) {
      document.removeEventListener("touchmove", blockPinchZoom);
      //document.removeEventListener("touchend", blockTapZoom);
    }
    document.body.classList.remove(styles.noscroll);
    document.removeEventListener("keydown", this.handleKeyDown);
    this.setState({ open: false });
    if (this.editMode) this.saveTranscription();
  }

  checkStoredText(text) {
    if (this.state.archiveItemKey) {
      let savedText = window.localStorage.getItem(this.state.archiveItemKey);
      if (savedText) {
        savedText = savedText.trim();
        if (savedText !== text) {
          const useSaved = window.confirm("It looks like your work was interrupted. Do you want to restore your previous work?");
          if (useSaved) {
            this.setState({ text: savedText, caretPos: savedText.length });
          }
        }
        window.localStorage.removeItem(this.state.archiveItemKey);
      }
    }
  }

  saveTranscription() {
    let newValue = this.state.text.trim();
    if (newValue.length) {
      newValue += '\n';
    }
    newValue = newValue.replace(/ *\n/g, '<br>\n');
    if (newValue !== this.props.textbox.value) {
      this.props.textbox.value = newValue;
    }

    if (this.state.archiveItemKey) {
      window.localStorage.removeItem(this.state.archiveItemKey);
    }
  }

  handleKeyDown = e => {
    if (e.key === "Escape" && !(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
      this.handleClose();
      e.preventDefault();
    } else if (this.editMode) {
      this.focusTextArea();
    } else if (!(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)) {
      if (e.key === "ArrowLeft") {
        if (this.state.archiveItem.leaf > 0) {
          this.setLeaf(this.state.archiveItem.leaf - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (this.state.archiveItem.leaf < this.props.wikipages.length-1) {
          this.setLeaf(this.state.archiveItem.leaf + 1);
        }
      }
    }
  }

  handleTextChange = (text, caretPos) => {
    if (text !== null) {
      this.setState({ text, caretPos });
      if (this.state.archiveItemKey) {
        window.localStorage.setItem(this.state.archiveItemKey, text);
      }
    } else if (this.state.caretPos !== caretPos) {
      this.setState({ caretPos });
    }
  }

  handleKeyPress = preText => {
    const ta = this.textAreaRef.current;
    this.setState({ text: preText + ta.value.slice(ta.selectionEnd), caretPos: preText.length });
  }

  handleCaretMove = e => {
    const sel = getSelection && getSelection(e);
    if (sel) {
      let { node, caretPos } = sel;

      while (node.previousSibling) {
        node = node.previousSibling;
        if (node.nodeType === 3) {
          caretPos += node.nodeValue.length;
        }
      }

      if (this.state.caretPos !== caretPos) {
        this.setState({ caretPos });
      }
    }
  }

  updateCaret() {
    if (this.state.emulateTextEdit) {
      const caret = this.caretRef.current;
      caret.offsetParent.scrollTop = caret.offsetTop;
    } else {
      const ta = this.textAreaRef.current;
      const { caretPos } = this.state;
      if (ta.selectionStart !== caretPos) {
        ta.setSelectionRange(caretPos, caretPos);
      }
      if (!platform.mobile && document.activeElement !== ta) {
        ta.focus();
      }
    }
  }

  focusTextArea() {
    const ta = this.textAreaRef.current;
    if (!platform.mobile && document.activeElement !== ta) {
      ta.focus();
    }
  }

  toggleKeyboard = () => {
    const keyboardOpen = !this.state.keyboardOpen;
    const emulateTextEdit = platform.mobile && keyboardOpen;

    const changedState = { keyboardOpen };
    if (emulateTextEdit !== this.state.emulateTextEdit) {
      changedState.emulateTextEdit = emulateTextEdit;
    }
    if (keyboardOpen && !emulateTextEdit) {
      changedState.caretPos = this.textAreaRef.current.selectionStart;
    }

    this.setState(changedState);
    window.localStorage.setItem(`keyboardOpen-${this.props.script}`, keyboardOpen);
  }

  setFont = font => {
    if (this.state.font !== font) {
      this.setState({ font });
      window.localStorage.setItem(`font-${this.props.script}`, font);
    }
  }

  setTransliterationOpen(transliterationOpen) {
    if (transliterationOpen !== this.state.transliterationOpen) {
      if (transliterationOpen) {
        if (this.state.text.trim().length) {
          this.getTransliteration().then(transliteration => {
            this.setState({ transliterationOpen, transliteration });
          });
        }
      } else {
        this.setState({ transliterationOpen });
      }
    }
  }

  getTransliteration() {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        action: "parse",
        prop: "text",
        text: `{{#transliterate:${this.state.language}|${this.state.text}}}`,
        contentmodel: "wikitext",
        disablelimitreport: 1,
        format: "json",
        formatversion: 2
      }).toString();
      window.fetch(this.getMediawikiApi() + '?' + params)
      .then(res => {
        res.json().then(json => {
          if (!json.error) {
            const div = document.createElement("div");
            div.innerHTML = json.parse.text;
            const output = div.querySelector(".mw-parser-output p");
            if (output) {
              return resolve(output.innerHTML.trim());
            }
          }
          reject();
        });
      }, reject);
    });
  }

  getIiifDimensions(leaf) {
    const imageData = this.props.iiifImageData;
    return imageData.all || imageData.pages[leaf];
  }

  getMediawikiApi() {
    return this.props.mediawikiApi || "/w/api.php";
  }

  getLeafImageUrl(leaf) {
    const params = new URLSearchParams({
      f: this.props.commonsFile,
      p: leaf + 1,
      w: 1024,
    }).toString();
    return `https://commons.wikimedia.org/w/thumb.php?${params}`;
  }

  async getLeafContents(leaf) {
    if (this.leafContents[leaf] === undefined) {
      const params = new URLSearchParams({
        action: "parse",
        page: this.props.wikipages[leaf],
        prop: "wikitext",
        contentformat: "application/json",
        format: "json",
        formatversion: 2
      }).toString();
      const res = await window.fetch(this.getMediawikiApi() + '?' + params);
      const resJson = await res.json();
      this.leafContents[leaf] = resJson.parse
        ? JSON.parse(resJson.parse.wikitext).body
        : "";
    }
    return this.leafContents[leaf];
  }

  async setLeaf(leaf) {
    this.setState({
      text: await this.getLeafContents(leaf),
      imageUrl: this.getLeafImageUrl(leaf),
      imageLoading: true,
      iiifDimensions: this.getIiifDimensions(leaf),
      transliterationOpen: false,
      ...this.finalizeState({ ...this.state.archiveItem, leaf }),
    });
  }

  render() {
    const editMode = this.editMode;
    const { script } = this.props;
    const {
      open, text, caretPos, emulateTextEdit, font,
      keyboardAvailable, keyboardOpen, transliterationOpen,
      imageUrl, iiifUrl, iiifDimensions, imageLoading,
    } = this.state;
    const { archiveItem: { leaf } } = this.state;

    return (
      <div className={styles.App}>
        <div className={cx(styles.transcriber, !open && styles.closed)}>
          <div className={cx(styles.image, !keyboardOpen && styles.expanded)}>
            <PinchZoomPan
              imageUrl={imageUrl}
              iiifUrl={iiifUrl}
              iiifDimensions={{width: iiifDimensions[0], height: iiifDimensions[1]}}
              maxScale={5}
              enhanceScale={1.5}
              doubleTapBehavior="zoom"
              zoomButtons={!platform.mobile}
              onImageLoad={() => this.state.imageLoading && this.setState({ imageLoading: false })}
            />
            {imageLoading &&
              <div className={styles.spinner}>
                <FontAwesomeIcon icon={faSpinner} size="2x" className="fa-spin" />
              </div>
            }
          </div>
          {editMode ?
            (emulateTextEdit ?
              <div className={cx(styles.text, styles[font])} onClick={this.handleCaretMove}>
                {text.slice(0, caretPos)}
                <span className={styles.caret} ref={this.caretRef}></span>
                {text.slice(caretPos)}
              </div>
            :
              <textarea
                className={cx(styles.text, styles[font], !keyboardOpen && styles.expanded)}
                value={text}
                spellCheck="false"
                ref={this.textAreaRef}
                onChange={e => this.handleTextChange(e.target.value, e.target.selectionStart)}
                onSelect={keyboardOpen ? (e => this.handleTextChange(null, e.target.selectionStart)) : undefined}
              />
            )
          :
            <>
              <div className={cx(styles.text, styles[font], styles.expanded)}>
                {text}
              </div>
              {leaf > 0 &&
                <button
                  className={cx(styles.button,styles.prev)}
                  onClick={() => this.setLeaf(leaf - 1)}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </button>
              }
              {leaf < this.props.wikipages.length-1 &&
                <button
                  className={cx(styles.button,styles.next)}
                  onClick={() => this.setLeaf(leaf + 1)}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </button>
              }
            </>
          }
          <div
            className={cx(styles.transliteration, transliterationOpen && styles.visible, !keyboardOpen && styles.expanded)}
          >
            <button
              className={cx(styles.button,styles.closeTransliteration)}
              onClick={() => this.setTransliterationOpen(false)}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className={styles.transliterationText}>
              {this.state.transliteration}
            </div>
          </div>
          {open && keyboardOpen &&
            <Keyboard
              script={script}
              className={styles[font]}
              emulateTextEdit={emulateTextEdit}
              onTextChange={this.handleTextChange}
              onKeyPress={this.handleKeyPress}
              text={text}
              caretPos={caretPos}
            />
          }
        </div>
        {open ?
          <div className={cx(styles.buttons, platform.mobile ? styles.vert : styles.horiz)}>
            <button
              className={styles.button}
              onClick={this.handleClose}
            >
              <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <Popup
              on="click"
              contentStyle={{width: "14em"}}
              trigger={<button className={styles.button}><FontAwesomeIcon icon={faEllipsisV} /></button>}
              position="bottom right"
            >
              {close => (
                <>
                  <MenuItem close={close}
                    label="Show Transliteration"
                    onClick={() => this.setTransliterationOpen(true)}
                  />
                  {editMode && keyboardAvailable &&
                    <MenuItem close={close}
                      label={(keyboardOpen ? "Hide" : "Show") + " Onscreen Keyboard"}
                      onClick={this.toggleKeyboard}
                    />
                  }
                  {scriptFont[script] && scriptFont[script].fonts &&
                    <>
                      <MenuItem close={close} label="Set Font:" className={styles.disabled} />
                      {scriptFont[script].fonts.map(([name,displayName]) =>
                        name === font ?
                          <MenuItem close={close}
                            key={name}
                            label={displayName}
                            spanClassName={cx(styles.indented,styles.checked)}
                          />
                        :
                          <MenuItem close={close}
                            key={name}
                            label={displayName}
                            spanClassName={styles.indented}
                            onClick={() => this.setFont(name)}
                          />
                      )}
                    </>
                  }
                </>
              )}
            </Popup>
          </div>
        :
          <button
            className={cx(styles.button,styles.open)}
            onClick={this.handleOpen}
          >
            <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=yes" />
            <FontAwesomeIcon icon={editMode ? faKeyboard : faBookOpen} />
          </button>
        }
      </div>
    );
  }
}
