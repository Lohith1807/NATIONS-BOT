const emojis = {
  th11: "1420007557564465203",
  th12: "1420007543601893466",
  th13: "1420007527441104946",
  th17: "1420007413301379203",
  th16: "1420007451041730560",
  th15: "1420007479386832987",
  th14: "1420007506335502336",
  th18: "1440692296327762050",
  arrow: "1420007624522334288",
  cocfight: "1420007644554596524",
  clancastle: "1420007667966939226",
  whited: "1420007713576058902",
  whitefwa: "1420007713576058902", // Alias for whited
  fwalead: "1420007731850641520",
  throphy: "1420007771319046186",
  cwl: "1420007799244591125",
  crown: "1420007825161322528",
  coc: "1420007846157877361",
  ccw: "1420007869943775243",
  heart: "1420007934930325676",
  alaram: "1420007958103724243",
  bluex: "1420008001841926185",
  question: "1420008034465218632",
  gtick: "1420008055898378310",
  bluestar: "1420008175893090485",
  bh: "1420008077272416286",
  mem: "1420012770509717625",
  tag: "1420012797038694530",
  xp: "1427657354006233190",
  uparrow: "1427657352689221652",
  downarrow: "1427657334359986297",
  capitalgold: "1427657365884371078",
  graph: "1427657315930345624",
  larrow: "1429289992185970780",
  rarrow: "1429289946681839736",
  clangames: "1427657378610020383",
  sheild: "1427657388525359266",
  refresh: "1506942299832061972" 
};

// Function to get animated emoji (with <a:>), else static emoji (<:>)
const animatedEmojis = new Set([
  "arrow",
  "crown",
  "heart",
  "alaram",
  "whited",
  "whitefwa",
  "bluex",
  "question",
  "bluestar",
  "cocfight",
  "downarrow",
  "uparrow",
  "graph"
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

