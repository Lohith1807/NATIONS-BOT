const emojis = {
  "parrow": "1516089889110753383",
  "arrow": "1516089892080193706",
  "cocfight": "1516089895398146262",
  "gtick": "1516089897209827519",
  "question": "1516089899240132640",
  "bluex": "1516089901349736570",
  "bluefwa": "1516089904273031309",
  "alaram": "1516089907913953393",
  "heart": "1516089909964963932",
  "tickred": "1516089913072681170",
  "ccw": "1516089918361702602",
  "coc": "1516089922346291331",
  "crown": "1516089924841898006",
  "cwl": "1516089927987626095",
  "throphy": "1516089931129422026",
  "th14": "1516089933838811216",
  "th15": "1516089936208466044",
  "th16": "1516089939014451342",
  "th17": "1516089941677838416",
  "fwalead": "1516089944265855048",
  "whitefwa": "1516089946304413698",
  "clancastle": "1516089949588426804",
  "th13": "1516089951865933885",
  "th12": "1516089954256814110",
  "th11": "1516089956471148686",
  "mem": "1517183824067297330",
  "wow": "1516089962431250473",
  "drop": "1516089964398379159",
  "rarrow": "1516089966307049494",
  "larrow": "1516089968479436932",
  "bluestar": "1516089971100876800",
  "uparrow": "1516089973638692864",
  "downarrow": "1516089977115512873",
  "graph": "1516089980441596065",
  "xp": "1516089982253793502",
  "capitalgold": "1516089984854261782",
  "clangames": "1516089986796228789",
  "sheild": "1516089989065343126",
  "th18": "1516089990789206136",
  "book": "1516089992928297183",
  "blood": "1516089995142893638",
  "pinkdot": "1516089998070386841",
  "orangedot": "1516090000553541696",
  "cyandot": "1516090003531370506",
  "bluedot": "1516090005444100097",
  "rarroww": "1516090007914287237",
  "yarrow": "1516090009596198963",
  "chain": "1516090011622182932",
  "refresh": "1516090022774837328",
  "delete": "1516659289119391764",
  "thunder":"1517183845227827420",
  "gift":"1517183839062069289",
  "no1":"1517183835446579452",
  "dart":"1517183826810507355",
  "redcrown":"1517183820430835842",
  "dragon": "1529355374035996742",
  "valkk": "1529356909675806912",
  "gob": "1529356912397652058"
};

// Set of animated emoji names to determine <a:name:id> formatting
const animatedEmojis = new Set([
  "parrow",
  "arrow",
  "cocfight",
  "question",
  "bluex",
  "bluefwa",
  "alaram",
  "heart",
  "tickred",
  "crown",
  "whitefwa",
  "wow",
  "bluestar",
  "uparrow",
  "downarrow",
  "graph",
  "book",
  "pinkdot",
  "orangedot",
  "cyandot",
  "bluedot",
  "rarroww",
  "yarrow",
  "chain",
  "thunder",
  "gift",
  "no1",
  "dart",
  "redcrown",
]);

const getEmoji = (name) => {
  if (!emojis[name]) return ""; // Return empty string if emoji not found
  const id = emojis[name];
  if (animatedEmojis.has(name)) {
    return `<a:${name}:${id}>`;
  }
  return `<:${name}:${id}>`;
};

const getEmojiObject = (name) => {
  if (!emojis[name]) return null;
  return {
    id: emojis[name],
    name: name,
    animated: animatedEmojis.has(name)
  };
};

const emojiMap = {
  // Pointers & Arrows
  "➡️": "arrow", "👉": "arrow", "▶️": "arrow", "➔": "arrow", "➜": "arrow", "➤": "arrow", "➡": "arrow", "🔺": "arrow",
  "🔸": "arrow", "🔷": "arrow", "🔹": "arrow", "🔼": "arrow", "🔽": "arrow", "⏫": "arrow", "⏬": "arrow",
  "arrow": "arrow", "parrow": "parrow", "yarrow": "yarrow", "rarroww": "rarroww",
  "uparrow": "uparrow", "downarrow": "downarrow",

  // Success & Ticks
  "✅": "gtick", "🟢": "gtick", "✔️": "gtick", "☑️": "gtick", "👍": "gtick", "👌": "gtick",                                                                                                                                                                                                                                                                                                     
  "gtick": "gtick",

  // Failures & Crosses
  "❌": "bluex", "🔴": "bluex", "🚫": "bluex", "🗑️": "bluex", "👎": "bluex", "🛑": "bluex", "💀": "bluex",
  "bluex": "bluex", "tickred": "tickred",

  // Alarms, Alerts & Bells
  "⚠️": "alaram", "⚙️": "alaram", "🔇": "alaram", "🔔": "alaram", "📣": "alaram", "📢": "alaram", "🚨": "alaram", "⏰": "alaram", "⏳": "alaram",
  "alaram": "alaram",

  // Shields, Strength & Defense
  "🛡️": "sheild", "🔒": "sheild", "🔑": "sheild", "🔐": "sheild", "💪": "sheild", "🏋️": "sheild", "⛓️": "sheild",
  "sheild": "sheild",

  // Trophies, Medals & Place Winners
  "🏆": "no1", "🎖️": "cwl", "🥇": "cwl", "🥈": "throphy", "🥉": "throphy", "🏅": "throphy", "👑": "crown",
  "crown": "crown", "cwl": "cwl", "throphy": "throphy",
  "no1": "no1", "redcrown": "redcrown",

  // Castles, Houses & Bases
  "🏯": "clancastle", "🏰": "clancastle", "🏠": "clancastle", "🏡": "clancastle",
  "clancastle": "clancastle",

  // Fights, Combat & War
  "⚔️": "cocfight", "⚔": "cocfight", "🗡️": "cocfight", "🗡": "cocfight", "🔫": "cocfight", "🏹": "cocfight", "💣": "cocfight",
  "cocfight": "cocfight",

  // Members & People
  "👤": "mem", "🧑": "mem", "👥": "mem", "👨": "mem", "👩": "mem",
  "mem": "mem",

  // Liquids, Water, Elixirs & Blood
  "🩸": "blood", "🧪": "drop", "🌊": "drop", "💧": "drop", "💦": "drop", "🥤": "drop",
  "blood": "blood", "drop": "drop",

  // Hearts, Love & Fire
  "❤️": "heart", "💖": "heart", "💝": "heart", "💕": "heart", "🔥": "heart", "💥": "heart",
  "heart": "heart",

  // Books, Writing & Sparkles
  "📖": "book", "📚": "book", "📋": "book", "🗂️": "book", "🔍": "book", "📄": "book", "🏷️": "book", "📝": "book",
  "✨": "bluestar", "⭐": "bluestar", "🌟": "bluestar", "💫": "bluestar", "🎯": "dart",
  "book": "book", "bluestar": "bluestar", "dart": "dart",

  // Chains & Links
  "🔗": "chain", "🖇️": "chain",
  "chain": "chain",

  // Refresh & Settings
  "🔄": "refresh", "♻️": "refresh", "🔃": "refresh", "⚙️": "refresh",
  "refresh": "refresh",

  // Graphs, Scales & Measurements
  "⚖️": "graph", "🏋️": "graph", "📊": "graph", "📈": "graph", "⚡": "thunder",
  "graph": "graph", "thunder": "thunder",

  // Gifts, Presents & Celebration
  "🎁": "gift", "🎉": "gift", "🎊": "gift", "🎈": "gift", "🎂": "gift", "🌳": "cyandot",
  "gift": "gift", "wow": "wow"
};

const findCustomEmoji = (name) => {
  const lowerName = name.toLowerCase();
  
  if (emojiMap[lowerName]) return emojiMap[lowerName];
  if (emojis[lowerName]) return lowerName;
  
  // Fuzzy substring matching
  for (const key of Object.keys(emojis)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return key;
    }
  }
  
  // Fallback to a random high-quality general custom emoji key
  const generalKeys = [
    "arrow", "parrow", "yarrow", "rarroww", "pinkdot", "orangedot", "cyandot", "bluedot", 
    "heart", "alaram", "bluestar", "wow", "crown", "redcrown", "thunder", "gift", "dart"
  ];
  return generalKeys[Math.floor(Math.random() * generalKeys.length)];
};

const prettifyText = (text) => {
  if (!text) return text;
  
  // 1. Remove excess blank lines (max 2 consecutive newlines)
  let cleanText = text.replace(/\n{3,}/g, '\n\n').trim();

  // 2. Prettify headers & lists line by line
  let lines = cleanText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    // Auto-bold key headings that end with a colon (e.g. "How it Works:") if they aren't already bold
    if (line.endsWith(':') && !line.startsWith('**') && !line.startsWith('__')) {
      // Find if there is an emoji at the start
      const emojiPrefixMatch = line.match(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)\s*(.*)/u);
      if (emojiPrefixMatch) {
        const emoji = emojiPrefixMatch[1];
        const heading = emojiPrefixMatch[2];
        lines[i] = `${emoji} **${heading}**`;
      } else {
        lines[i] = `**${line}**`;
      }
    }

    // Auto-adjust spaces between emojis and text (ensure exactly one space after a leading emoji)
    lines[i] = lines[i].replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)\s*(?=\S)/u, '$1 ');
    
    // Auto-adjust spaces around trailing emojis at the end of headings/lines
    lines[i] = lines[i].replace(/\s+(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:\w+:\d+>)$/u, ' $1');
  }

  return lines.join('\n');
};

const processEmojis = (text) => {
  if (!text) return text;

  // 1. Process custom Discord emojis: <:name:id> or <a:name:id>
  let processed = text.replace(/<a?:(\w+):\d+>/g, (match, name) => {
    const mappedName = findCustomEmoji(name);
    return getEmoji(mappedName);
  });

  // 2. Process custom shortcodes: :name:
  processed = processed.replace(/:(\w+):/g, (match, name) => {
    const mappedName = findCustomEmoji(name);
    return getEmoji(mappedName);
  });

  // 3. Process Unicode emojis
  const unicodeEmojiRegex = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F/gu;
  processed = processed.replace(unicodeEmojiRegex, (match) => {
    const cleanMatch = match.replace(/\uFE0F/g, '');
    const mappedName = emojiMap[cleanMatch] || emojiMap[match];
    if (mappedName) {
      return getEmoji(mappedName);
    }
    
    // If not explicitly mapped, fallback to a random animated bot emoji
    const generalKeys = [
      "arrow", "parrow", "yarrow", "rarroww", "pinkdot", "orangedot", "cyandot", "bluedot", 
      "heart", "alaram", "bluestar", "wow", "crown", "redcrown", "thunder", "gift", "dart"
    ];
    const randKey = generalKeys[Math.floor(Math.random() * generalKeys.length)];
    return getEmoji(randKey);
  });

  // 4. Prettify layout and auto-adjust spacing/formatting
  processed = prettifyText(processed);

  return processed;
};

const revertEmojis = (text) => {
  if (!text) return text;
  return text.replace(/<a?:(\w+):\d+>/g, (match, name) => {
    if (emojis[name]) {
      return `:${name}:`;
    }
    return match;
  });
};

module.exports = {
  emojis,
  getEmoji,
  getEmojiObject,
  processEmojis,
  revertEmojis
};
