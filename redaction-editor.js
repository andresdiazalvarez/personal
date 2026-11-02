(function (root) {
  class RedactionEditor {
    constructor() {
      this.text = "";
      this.autoPeriod = false;
      this.narrator = false;
      this.dialogue = false;
    }

    sync(value) {
      if (value !== this.text) {
        this.text = value;
        this.autoPeriod = false;
        this.narrator = false;
      }
    }

    isOpen() {
      let question = 0;
      let exclamation = 0;
      for (const char of this.text) {
        if (char === "¿") question++;
        if (char === "?") question = Math.max(0, question - 1);
        if (char === "¡") exclamation++;
        if (char === "!") exclamation = Math.max(0, exclamation - 1);
      }
      return question > 0 || exclamation > 0;
    }

    removeAutomaticPeriod() {
      if (this.autoPeriod) this.text = this.text.replace(/\.$/, "");
      this.autoPeriod = false;
    }

    punctuation(sign) {
      this.removeAutomaticPeriod();
      this.text = this.text.trimEnd();
      if (sign === "." && /[.?!]$/.test(this.text)) return;
      if (this.text.endsWith(sign)) return;
      this.text = this.text.replace(/[.,:;]+$/, "") + sign;
      this.narrator = false;
    }

    words(value) {
      let words = value.trim();
      if (!words) return;
      const start = !this.text.trim() || /(?:[.?!]|\n|[¿¡—])\s*$/.test(this.text);
      if (start || this.narrator) {
        words = words.replace(/\p{L}/u, (letter) => this.narrator ? letter.toLocaleLowerCase("es") : letter.toLocaleUpperCase("es"));
      }
      const space = this.text && !/\s$|[¿¡—]$/.test(this.text) && !/^[.,:;?!]/.test(words);
      this.text += (space ? " " : "") + words;
      this.autoPeriod = false;
      this.narrator = false;
    }

    command(command) {
      if (command === "aparte" || command === "raya de diálogo") {
        this.finish();
        this.text = this.text.trimEnd();
        if (this.text) this.text += "\n\n";
        if (command === "raya de diálogo") this.text += "—";
        this.dialogue = command === "raya de diálogo";
        this.autoPeriod = false;
        return;
      }
      if (command === "inciso del narrador") {
        this.removeAutomaticPeriod();
        this.text = this.text.trimEnd() + " —";
        this.narrator = true;
        return;
      }
      const signs = { punto: ".", coma: ",", "dos puntos": ":", "cerrar interrogación": "?", "cerrar admiración": "!" };
      if (signs[command]) return this.punctuation(signs[command]);
      const opening = command === "abrir interrogación" ? "¿" : "¡";
      this.removeAutomaticPeriod();
      if (!this.text.endsWith(opening)) {
        const space = this.text && !/\s$|—$/.test(this.text);
        this.text += (space ? " " : "") + opening;
      }
    }

    apply(transcript, value = this.text) {
      this.sync(value);
      const pattern = /(?<![\p{L}\p{N}_])(raya de di[aá]logo|inciso del narrador|abrir interrogaci[oó]n|cerrar interrogaci[oó]n|abrir admiraci[oó]n|cerrar admiraci[oó]n|dos puntos|aparte|punto|coma)(?![\p{L}\p{N}_])/giu;
      let offset = 0;
      for (const match of transcript.matchAll(pattern)) {
        this.words(transcript.slice(offset, match.index));
        const normalized = match[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const canonical = { "raya de dialogo": "raya de diálogo", "abrir interrogacion": "abrir interrogación", "cerrar interrogacion": "cerrar interrogación", "abrir admiracion": "abrir admiración", "cerrar admiracion": "cerrar admiración" };
        this.command(canonical[normalized] || normalized);
        offset = match.index + match[0].length;
      }
      this.words(transcript.slice(offset));
      this.finish();
      return this.text;
    }

    finish() {
      if (this.isOpen() || !this.text.trim() || /[.,:;?!¿¡—\s]$/.test(this.text)) return;
      this.text += ".";
      this.autoPeriod = true;
    }
  }
  if (typeof module !== "undefined") module.exports = RedactionEditor;
  else root.RedactionEditor = RedactionEditor;
})(globalThis);
