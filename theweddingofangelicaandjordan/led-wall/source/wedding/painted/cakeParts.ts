// The candle scene's pieces (stage key 3), made by trace/cake-cut.py from cake-source.png + master-face.py's cake faces:
// each piece's box in the picture ([x, y, w, h], picture px); the candles (stick columns, top, where the piping
// covers it, the flame's box, the wick: [x, top, bottom]); the eyes (corners, lids, lash colour) for the blinks drawn
// in code; and where each one's pursed lips reach (the front tip: his rightmost, hers leftmost; his pushed out to his
// face's edge for the kiss, `dan.kiss`).
export const CAKE = {
  size: [2000, 667] as const,
  boxes: {
    "front": [105, 372, 1753, 295],
    "sticks": [640, 367, 701, 39],
    "flame1": [635, 313, 30, 54],
    "flame2": [738, 318, 30, 51],
    "flame3": [843, 320, 29, 49],
    "flame4": [940, 316, 30, 54],
    "flame5": [1037, 317, 30, 52],
    "flame6": [1137, 321, 29, 48],
    "flame7": [1229, 317, 31, 52],
    "flame8": [1315, 310, 31, 57],
    "dan": [11, 5, 961, 662],
    "dan.blow": [533, 292, 70, 64],
    "dan.smile": [525, 293, 72, 63],
    "dan.lids": [476, 228, 136, 49],
    "ange": [1040, 78, 956, 589],
    "ange.blow": [1403, 312, 43, 50],
    "ange.smile": [1395, 313, 70, 51],
    "ange.lids": [1374, 231, 179, 65],
    "dan.kiss": [533, 292, 76, 64],
    "ange.lips": [1408, 316, 34, 43],
  } as Record<string, number[]>,
  candles: [
    {"cx": 649.5, "x0": 641, "x1": 658, "top": 367, "pip": 405, "flame": [635, 313, 30, 54], "wick": [649.2, 357, 367]},
    {"cx": 752.5, "x0": 744, "x1": 761, "top": 369, "pip": 404, "flame": [738, 318, 30, 51], "wick": [752.4, 360, 369]},
    {"cx": 856.0, "x0": 848, "x1": 864, "top": 369, "pip": 405, "flame": [843, 320, 29, 49], "wick": [856.3, 361, 369]},
    {"cx": 954.5, "x0": 946, "x1": 963, "top": 370, "pip": 406, "flame": [940, 316, 30, 54], "wick": [954.7, 360, 370]},
    {"cx": 1051.5, "x0": 1043, "x1": 1060, "top": 369, "pip": 406, "flame": [1037, 317, 30, 52], "wick": [1051.5, 360, 369]},
    {"cx": 1150.0, "x0": 1142, "x1": 1158, "top": 369, "pip": 405, "flame": [1137, 321, 29, 48], "wick": [1149.7, 361, 369]},
    {"cx": 1244.0, "x0": 1236, "x1": 1252, "top": 369, "pip": 405, "flame": [1229, 317, 31, 52], "wick": [1244.0, 360, 369]},
    {"cx": 1330.0, "x0": 1321, "x1": 1339, "top": 367, "pip": 404, "flame": [1315, 310, 31, 57], "wick": [1329.9, 356, 367]},
  ],
  eyes: {
    dan: {"eyes": [{"l": [482, 248.3], "r": [534, 247.9], "top": 235, "bot": 256}, {"l": [585, 261.7], "r": [605, 256.4], "top": 249, "bot": 269}], "ink": "#000000"},
    ange: {"eyes": [{"l": [1382, 263.0], "r": [1416, 262.8], "top": 242, "bot": 282}, {"l": [1468, 267.6], "r": [1546, 273.1], "top": 245, "bot": 282}], "ink": "#010000"},
  },
  lips: {"dan": [584, 316.1], "ange": [1412, 330.0], "dan.kiss": [595, 316.1]},
};
