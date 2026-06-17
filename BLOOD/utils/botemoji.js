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
  "mem": "1516089959000444970",
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
  "delete": "1516659289119391764"
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
  "chain"
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

module.exports = {
  emojis,
  getEmoji,
  getEmojiObject
};
