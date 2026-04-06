function escapeControlCharactersInJsonStrings(text: string): string {
  let inString = false;
  let escaped = false;
  let output = "";

  for (const character of text) {
    if (inString) {
      if (escaped) {
        output += character;
        escaped = false;
        continue;
      }

      if (character === "\\") {
        output += character;
        escaped = true;
        continue;
      }

      if (character === '"') {
        output += character;
        inString = false;
        continue;
      }

      if (character === "\n") {
        output += "\\n";
        continue;
      }

      if (character === "\r") {
        output += "\\r";
        continue;
      }

      if (character === "\t") {
        output += "\\t";
        continue;
      }

      const code = character.charCodeAt(0);
      if (code < 0x20) {
        output += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }

      output += character;
      continue;
    }

    if (character === '"') {
      inString = true;
    }

    output += character;
  }

  return output;
}

function decodeEscapeSequence(text: string, startIndex: number): {
  value: string;
  consumed: number;
} {
  const marker = text[startIndex];

  if (!marker) {
    return { value: "", consumed: 0 };
  }

  switch (marker) {
    case '"':
    case "\\":
    case "/":
      return { value: marker, consumed: 1 };
    case "b":
      return { value: "\b", consumed: 1 };
    case "f":
      return { value: "\f", consumed: 1 };
    case "n":
      return { value: "\n", consumed: 1 };
    case "r":
      return { value: "\r", consumed: 1 };
    case "t":
      return { value: "\t", consumed: 1 };
    case "u": {
      const codePoint = text.slice(startIndex + 1, startIndex + 5);
      if (/^[0-9a-fA-F]{4}$/.test(codePoint)) {
        return {
          value: String.fromCharCode(Number.parseInt(codePoint, 16)),
          consumed: 5,
        };
      }

      return { value: "u", consumed: 1 };
    }
    default:
      return { value: marker, consumed: 1 };
  }
}

function skipWhitespace(text: string, startIndex: number): number {
  let index = startIndex;
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }

  return index;
}

function parseStrictString(
  text: string,
  startIndex: number,
): { value: string; nextIndex: number } {
  let index = startIndex;
  if (text[index] !== '"') {
    throw new Error("Expected a string key wrapped in double quotes.");
  }

  index += 1;
  let value = "";

  while (index < text.length) {
    const character = text[index];

    if (character === '"') {
      return { value, nextIndex: index + 1 };
    }

    if (character === "\\") {
      const decoded = decodeEscapeSequence(text, index + 1);
      value += decoded.value;
      index += decoded.consumed + 1;
      continue;
    }

    value += character;
    index += 1;
  }

  throw new Error("Unterminated JSON string.");
}

function parseRelaxedStringValue(
  text: string,
  startIndex: number,
): { value: string; nextIndex: number } {
  let index = startIndex;
  if (text[index] !== '"') {
    throw new Error("Expected a string value wrapped in double quotes.");
  }

  index += 1;
  let value = "";

  while (index < text.length) {
    const character = text[index];

    if (character === "\\") {
      const decoded = decodeEscapeSequence(text, index + 1);
      value += decoded.value;
      index += decoded.consumed + 1;
      continue;
    }

    if (character === '"') {
      const nextTokenIndex = skipWhitespace(text, index + 1);
      const nextToken = text[nextTokenIndex];
      if (
        nextToken === "," ||
        nextToken === "}" ||
        nextToken === undefined
      ) {
        return { value, nextIndex: index + 1 };
      }

      value += '"';
      index += 1;
      continue;
    }

    value += character;
    index += 1;
  }

  throw new Error("Unterminated string value.");
}

function parsePromptObjectRelaxed(rawText: string): Record<string, string> {
  let index = skipWhitespace(rawText, 0);
  if (rawText[index] !== "{") {
    throw new Error("Prompt instructions must be a JSON object.");
  }

  index += 1;
  const output: Record<string, string> = {};

  while (index < rawText.length) {
    index = skipWhitespace(rawText, index);

    if (rawText[index] === "}") {
      return output;
    }

    const keyResult = parseStrictString(rawText, index);
    index = skipWhitespace(rawText, keyResult.nextIndex);

    if (rawText[index] !== ":") {
      throw new Error("Expected ':' after key.");
    }

    index = skipWhitespace(rawText, index + 1);
    const valueResult = parseRelaxedStringValue(rawText, index);
    output[keyResult.value] = valueResult.value;
    index = skipWhitespace(rawText, valueResult.nextIndex);

    if (rawText[index] === ",") {
      index += 1;
      continue;
    }

    if (rawText[index] === "}") {
      return output;
    }

    throw new Error("Expected ',' or '}' after value.");
  }

  throw new Error("Prompt instructions object is not closed.");
}

export function parsePromptInstructionsJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText) as unknown;
  } catch (firstError) {
    const sanitized = escapeControlCharactersInJsonStrings(rawText);

    try {
      return JSON.parse(sanitized) as unknown;
    } catch {
      try {
        return parsePromptObjectRelaxed(rawText);
      } catch {
        throw firstError;
      }
    }
  }
}
