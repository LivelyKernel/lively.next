const emojiLengths = {
    '🗨️' : 3 ,
    '🌳' : 2,
    '🎀' : 2,
    '🔣' : 2,
    '🛠️' : 3,
    '🧑‍🏫' : 5,
    '💭' : 2,
    '🎛️' : 3,
    '🗺️' : 3,
    '🫓' : 2,
    '❄️' : 2,
    '🛤️' : 3,
    '🖌️' : 3,
    '👼' : 2,
    '🤕' : 2,
    '🧰' : 2,
    '📦' : 2,
    '⌨️' : 2,
    '📙' : 2,
    '🧩' : 2,
    '🎨' : 2,
    '🔔' : 2,
    '📂' : 2,
    '🪨' : 2,
    '🗒️' : 3,
    '📇' : 2,
    '👔' : 2,
    '🐚' : 2,
    '🔁' : 2,
    '💾' : 2,
    '📠' : 2,
    '⚙️' : 2,
    '👤' : 2,
    '🖥️' : 3
}

function emojifiedLength (string){
    let len = string.length;
    for (const emoji in emojiLengths) {
        const re = new RegExp(emoji,'g');
        const count = (string.match(re) || []).length;
        if (string.includes(emoji)) len -= count * (emojiLengths[emoji]-1);
    };  
    return len;
} 

exports.emojifiedLength = emojifiedLength;