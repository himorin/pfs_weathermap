// Policy:
//  do not rely on external library, incl jQuery etc.

const defConfig = {
  arrow_width: 5,
  arrow_head: 10,
  data_api: undefined,
  data_interval: 60,
  image_file: "",
  image_width: 0,
  image_height: 0,
  image_font: 10,
  image_legend_x: 20,
  image_legend_y: 20,
  image_legend_r: 5,
  image_legend_sep: 0.3,
  image_legend_bar_width: 3,
  image_legend_legend_width: 10,
  image_lastupdated_x: 5,
  image_lastupdated_y: 5,
  target_name: "def",
  target_maxsave: undefined,
  load: {},
  switches: [],
  na: "black",
  unit: "",
  conv: 1.0,
  history: [],
  graph_history_xorig: 50,
  graph_history_xwidth: 650,
  graph_history_yorig: 260,
  graph_history_ywidth: -250,
};
const defConfigName = 'config.json';
const defSVG = 'http://www.w3.org/2000/svg';
const defXlink = 'http://www.w3.org/1999/xlink';
// has 26 color definitions (13 links) for history graph
// set color with array of config.history to change
const defHColor = [ "black", "blue", "lime", "red", "cyan", "yellow", "magenta",
  "navy", "green", "maroon", "teal", "purple", "olive", "gray", 
  "deepskyblue", "rosybrown", "darkslategray", "tan", "darkviolet", "plum",
  "sienna", "orangered", "brown", "gold", "greenyellow", "deeppink" ];

// prometheus query string
var query_in = "?query=rate(ifHCInOctets{instance=~'()'}[1m])*8";
var query_out = "?query=rate(ifHCOutOctets{instance=~'()'}[1m])*8";

var config = {};
var load_steps = [];
var link_lines;
var arrows;
var curExecTime;
var hist_color;
var disp_conv = 1.0;

function SetLegend(root, conf, font, id, color, text) {
  var elem_o_box = document.createElementNS(defSVG, 'rect');
  elem_o_box.setAttribute('x', conf.x + conf.r * 2);
  elem_o_box.setAttribute('y', conf.y + font * id * (1.0 + conf.sep) + conf.r * 2);
  elem_o_box.setAttribute('width', font * conf.bar_width);
  elem_o_box.setAttribute('height', font);
  elem_o_box.setAttribute('stroke', 'black');
  elem_o_box.setAttribute('stroke-width', 1);
  elem_o_box.setAttribute('fill', color);
  root.appendChild(elem_o_box);
  var elem_o_txt = document.createElementNS(defSVG, 'text');
  elem_o_txt.setAttribute('x', conf.x + conf.r * 2 + font * (conf.bar_width + 1));
  elem_o_txt.setAttribute('y', conf.y + conf.r * 2 + font * (id * (1.0 + conf.sep) + 1));
  elem_o_txt.textContent = text;
  elem_o_txt.setAttribute('font-size', font + 'px');
  root.appendChild(elem_o_txt);
};

function GetAPIPromise (query, dir, sw) {
  var query_app;
  if (sw === undefined) {
    query_app = query.replace(/{instance=~'\(\)'}/, '');
    sw = 'all'
  } else {
    query_app = query.replace(/\(\)/, '(' + sw + ')');
  }
  return fetch(config.data_api + query_app, {
    cache: 'no-cache', credentials: 'same-origin', method: 'GET' })
  .then((response) => {
    if (response.ok) {return response.json(); }
    throw Error('Returned API response ' + response.status);
  }).then(response => {
    if (response.status != 'success') {
      throw Error('API returned failed status on ' + query + ' for switch ' + sw + ': ' + response.status);
    }
    response.direction = dir;
    return response;
  });
}
function LoadDataInConfig() {
  if (config.data_api === undefined) {return ; }
  var p_arr = [];
  if (config.switches.length == 0) {
    p_arr.push(GetAPIPromise(query_in, 'up'));
    p_arr.push(GetAPIPromise(query_out, 'down'));
  } else {
    config.switches.forEach(id => {
      p_arr.push(GetAPIPromise(query_in, 'up', id));
      p_arr.push(GetAPIPromise(query_out, 'down', id));
    });
  }
  Promise.all(p_arr)
    .then(vals => {
      var cur_data = {};
      // in to switch is up
      vals.forEach(cval => {
        cval.data.result.forEach(val => {
          cur_data[val.metric.instance + '-' + val.metric.ifIndex + '-' + cval.direction] = 
            Math.round(parseFloat(val.value[1]) / disp_conv * 100.0) / 100.0;
        }) });
      SetLoadData(cur_data, curExecTime);
    }).catch(reason => {ShowError(reason.message); return; });
  curExecTime.setSeconds(curExecTime.getSeconds() + config.data_interval);
  if (config.data_api !== undefined) {
    window.setTimeout(LoadDataInConfig, curExecTime - Date.now());
  }
}

// load this function for renewing data
// ld is in format of 'sample-data.json'
function SetLoadData(ld, update) {
  var dat_arrows = {};
  Object.keys(arrows).forEach(function (dispid) {
    var name = arrows[dispid]['name'];
    dat_arrows[dispid] = {};
    if (ld[name] !== undefined) {
      dat_arrows[dispid]['value'] = ld[name];
      dat_arrows[dispid]['color'] = GetColor(ld[name]);
    } else {
      dat_arrows[dispid]['value'] = 'na';
      dat_arrows[dispid]['color'] = config.na;
    }
    document.getElementById(dispid).setAttribute('fill', dat_arrows[dispid]['color']);
    document.getElementById(dispid + '-tip').innerHTML = dispid + ': ' + dat_arrows[dispid]['value'] + ' ' + config.unit;
  });
  var date;
  if (update !== undefined) {date = new Date(update); }
  else {date = new Date(); }
  document.getElementById('lastupdated').innerHTML = 'Last updated: ' + date.toLocaleString();
  // for history, keep dat_arrows instead of ld, into IndexedDB
  var savedData;
  // debug use, uncomment this line to remove
  // XXX: need to have some code to do this from config
  // window.localStorage.removeItem(config.target.name);
  if (window.localStorage[config.target_name] !== undefined) {
    savedData = JSON.parse(window.localStorage[config.target_name]);
    savedData[Math.floor(date.getTime() / 1000)] = dat_arrows;
    // sort can work that date number is quite large without length changed
    if ((config.target_maxsave !== undefined) && (config.target_maxsave > 0)) {
      var deltarget = new Date();
      deltarget.setDate(deltarget.getDate() - config.target_maxsave);
      deltarget = Math.floor(deltarget.getTime() / 1000);
      Object.keys(savedData).sort().forEach(function (name) {
        if (name < deltarget) {delete savedData[name]; }
      });
    }
  } else {
    savedData = {};
    savedData[Math.floor(date.getTime() / 1000)] = dat_arrows;
  }
  window.localStorage[config.target_name] = JSON.stringify(savedData);
  UpdateHistoryGraph();
}
function GetColor(val) {
  var rcol = config.max;
  load_steps.some(function(cm) {
    if (val <= cm) {rcol = config.load[cm]; return true; }
  });
  return rcol;
}

function PathAdd(cur, add) {
  cur.x += add.x;
  cur.y += add.y;
  return cur;
}
function PathAvg(p0, p1) {
  return {'x': ((p0.x + p1.x) / 2.0), 'y': ((p0.y + p1.y) / 2.0)};
}
function PathVec(p0, p1) {
  var len = PathLen(p0, p1);
  return {'x': ((p1.x - p0.x) / len), 'y': ((p1.y - p0.y) / len)};
}
// rot = 0 orig, 1 90d, 2 180d, 3 270d
function PathAppVec(vec, len, rot) {
  var vec_x = vec.x;
  var vec_y = vec.y;
  if (rot == 1) {
    var tv = vec_x;
    vec_x = vec_y * -1;
    vec_y = tv;
  } else if (rot == 2) {
    vec_x *= -1;
    vec_y *= -1;
  } else if (rot == 3) {
    var tv = vec_x;
    vec_x = vec_y;
    vec_y = tv * -1;
  }
  return {'x': (len * vec_x), 'y': (len * vec_y)};
}
function PathLen(p0, p1) {
  return Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
}
function PathStr(str, pos) {
  return str + ' ' + pos.x + ' ' + pos.y + ' ';
};

function UpdateHistoryGraph() {
  var keys_arrows = Object.keys(arrows);
  var p_strs = {};
  var sdata;

  if (window.localStorage[config.target_name] !== undefined)
    {sdata = JSON.parse(window.localStorage[config.target_name]); }
  else {return false; }
  var keys_history = Object.keys(sdata).sort();

  // init
  if (keys_history.length <= 1) {return false; }
  var hstart = keys_history[0];
  var hend = keys_history[keys_history.length - 1];
  var hxunit = config.graph_history_xwidth / (hend - hstart);
  var hyunit = config.graph_history_ywidth / config.load_max;
  var hxorig = config.graph_history_xorig;
  var hyorig = config.graph_history_yorig;
  var td = new Date(hstart * 1000);
  document.getElementById("history_start").innerHTML = td.toLocaleString();
  var td = new Date(hend * 1000);
  document.getElementById("history_end").innerHTML = td.toLocaleString();
  keys_arrows.forEach(function (id) {
    p_strs[id] = "M" + hxorig + ",";
    if (sdata[hstart][id] !== undefined) {
      p_strs[id] += (hyorig + Math.floor(hyunit * sdata[hstart][id].value * 100) / 100);
    } else {
      p_strs[id] += hyorig;
    }
    p_strs[id] += " ";
  });

  // create strings
  for (var hid = 1; hid < keys_history.length; hid++) {
    var cx = hxorig + Math.floor(hxunit * (keys_history[hid] - hstart) * 100) / 100;
    keys_arrows.forEach(function (aid) {
      if (sdata[keys_history[hid]][aid] !== undefined) {
        p_strs[aid] += "L" + cx + ",";
        p_strs[aid] += (hyorig + Math.floor(hyunit * sdata[keys_history[hid]][aid].value * 100) / 100);
      }
    });
  }

  // append to svg
  var svg_hist = document.getElementById('wmhistory');
  Object.keys(p_strs).forEach(function (id) {
    if (document.getElementById("history_graph_line_" + id) != undefined) {
      document.getElementById("history_graph_line_" + id).setAttribute("d", p_strs[id]);
    } else {
      var elem_path = document.createElementNS(defSVG, 'path');
      elem_path.setAttribute("fill", "none");
      elem_path.setAttribute("d", p_strs[id]);
      elem_path.setAttribute("stroke", hist_color[id]);
      elem_path.setAttribute("stroke-width", 1);
      elem_path.setAttribute("id", "history_graph_line_" + id);
      svg_hist.appendChild(elem_path);
    }
  });
  return true;
}

function ShowError(err) {
  console.log(err);
}

function ParseConfig(conf) {
  config = Object.assign(config, defConfig, conf);
  [
    'image_legend_x', 'image_legend_y',
    'image_lastupdated_x', 'image_lastupdated_y',
    'data_interval',
  ].forEach((id) => { if (config[id] < 0) {config[id] = defConfig[id]; } });
  if (config.max === undefined) {config.max = config.na; }
  if (config.history === undefined) {config.history = defHColor; }
  if (config.conv !== undefined) {disp_conv = config.conv; }
  // sort and store color scheme
  load_steps = Object.keys(config.load).sort((a,b) => {
    a = parseInt(a); b = parseInt(b);
    if (a == 0) { return -1; } if (b == 0) { return -1; }
    if (a > b) { return 1; } if (a < b) {return -1; }
    return 0;
  });
}

window.addEventListener('load', function(event) {
  fetch(defConfigName, {
    cache: 'no-cache', credentials: 'same-origin', method: 'GET' })
  .then((response) => {
    if (response.ok) {return response.json(); }
    throw Error('Returned response ' + response.status);
  }).then((conf) => {
    ParseConfig(conf.config);
    DrawWeathermapElements();
    DrawWeathermapArrows(conf.link);
    DrawWeathermapHistory();
  }).catch((error) => {ShowError('Error occured: ' + error.message); });
});

// constract weathermap display
function DrawWeathermapElements() {
  var svg_root = document.getElementById('weathermap');
  if (svg_root == undefined) {
    console.log("weathermap SVG element not found.");
    return;
  }
  // weathermap size and background (will not change size of "wmhistory")
  svg_root.setAttribute("width", config.image_width);
  svg_root.setAttribute("height", config.image_height);
  svg_root.setAttribute("viewBox", "0 0 " + config.image_width + " " + config.image_height);
  var elem_img = document.createElementNS(defSVG,'image');
  elem_img.setAttribute("x", 0);
  elem_img.setAttribute("y", 0);
  elem_img.setAttribute("height", config.image_height);
  elem_img.setAttribute("width", config.image_width);
  elem_img.setAttributeNS(defXlink, 'href', config.image_file);
  svg_root.appendChild(elem_img);
  var elem_lastup = document.createElementNS(defSVG, 'text');
  elem_lastup.setAttribute("x", config.image_lastupdated_x);
  elem_lastup.setAttribute("y", config.image_lastupdated_y + config.image_font);
  elem_lastup.setAttribute("font-size", config.image_font);
  elem_lastup.setAttribute("id", 'lastupdated');
  svg_root.appendChild(elem_lastup);

  // weathermap legend
  var obj_il = {
    x: config.image_legend_x, y: config.image_legend_y,
    r: config.image_legend_r, sep: config.image_legend_sep,
    bar_width: config.image_legend_bar_width, 
    legend_width: config.image_legend_legend_width,
    font: config.image_font,
  };
  var elem_leg = document.createElementNS(defSVG, 'rect');
  elem_leg.setAttribute('x', obj_il.x);
  elem_leg.setAttribute('y', obj_il.y);
  elem_leg.setAttribute('rx', obj_il.r);
  elem_leg.setAttribute('ry', obj_il.r);
  elem_leg.setAttribute('width', obj_il.r * 2 
    + obj_il.font * obj_il.legend_width);
  elem_leg.setAttribute('height', obj_il.r * 3 
    + obj_il.font * ((load_steps.length + 3) * (1.0 + obj_il.sep)));
  elem_leg.setAttribute('fill', 'white');
  elem_leg.setAttribute('stroke', 'black');
  elem_leg.setAttribute('stroke-width', 1);
  svg_root.appendChild(elem_leg);
  var elem_leg_title = document.createElementNS(defSVG, 'text');
  elem_leg_title.setAttribute('x', obj_il.x + obj_il.r);
  elem_leg_title.setAttribute('y', obj_il.y + obj_il.r + obj_il.font);
  elem_leg_title.textContent = 'Traffic load (' + config.unit + ')';
  elem_leg_title.setAttribute('font-size', obj_il.font + 'px');
  svg_root.appendChild(elem_leg_title);
  // na
  var cid = 1;
  SetLegend(svg_root, obj_il, config.image_font, cid, config.na, 'n/a');
  // foreach
  var val_priv = 0;
  load_steps.forEach(function (name) {
    cid += 1;
    SetLegend(svg_root, obj_il, config.image_font, cid, config.load[name],
      val_priv + ' - ' + name);
    val_priv = name;
  });
  // max
  cid += 1;
  config.load_max = val_priv;
  SetLegend(svg_root, obj_il, config.image_font, cid, config.max,
    '> ' + config.load_max);
}

function DrawWeathermapArrows(link_lines) {
  var svg_root = document.getElementById('weathermap');
  if (svg_root == undefined) {
    console.log("weathermap SVG element not found.");
    return;
  }
  // weathermap arrows
  arrows = {};
  Object.keys(link_lines).forEach(function (name) {
    clink = link_lines[name];
    // pos calc
    clink.mid = PathAvg(clink.up, clink.down);
    clink.vec = PathVec(clink.up, clink.down);
    var len_arr = PathLen(clink.up, clink.down) / 2.0 - config.arrow_head;
    var cvec = clink.vec;
    var len_hw = config.arrow_width / 2.0;
    var len_hd = config.arrow_head;

    // down (from up end to mid)
    var elem_p = document.createElementNS(defSVG, 'path');
    var elem_cur = clink.up;
    var elem_str = PathStr('M', elem_cur);
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hw, 1)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_arr, 0)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd - len_hw, 1)));
    PathAdd(elem_cur, PathAppVec(cvec, len_hd, 0));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd, 3)));
    PathAdd(elem_cur, PathAppVec(cvec, len_hd, 2));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd, 3)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd - len_hw, 1)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_arr, 2)));
    elem_str += 'Z';
    elem_p.setAttribute('d', elem_str);
    elem_p.setAttribute('stroke', 'blue');
    elem_p.setAttribute('stroke-width', 1);
    elem_p.setAttribute('id', name + '-down');
    elem_p.setAttribute('class', 'wm-cls0');
    var elem_pt = document.createElementNS(defSVG, 'title');
    elem_pt.setAttribute('id', name + '-down-tip');
    elem_p.appendChild(elem_pt);
    svg_root.appendChild(elem_p);
    arrows[name + '-down'] = {};
    if (clink.down.name !== undefined) {
      arrows[name + '-down']['name'] = clink.down.name;
    } else if (clink.name !== undefined) {
      arrows[name + '-down']['name'] = clink.name + '-down';
    } else {
      arrows[name + '-down']['name'] = name + '-down';
    }
    // up (from down end to mid)
    var elem_p = document.createElementNS(defSVG, 'path');
    var elem_cur = clink.down;
    var elem_str = PathStr('M', elem_cur);
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hw, 1)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_arr, 2)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd - len_hw, 1)));
    PathAdd(elem_cur, PathAppVec(cvec, len_hd, 2));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd, 3)));
    PathAdd(elem_cur, PathAppVec(cvec, len_hd, 0));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd, 3)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_hd - len_hw, 1)));
    elem_str += PathStr('L', PathAdd(elem_cur, PathAppVec(cvec, len_arr, 0)));
    elem_str += 'Z';
    elem_p.setAttribute('d', elem_str);
    elem_p.setAttribute('stroke', 'red');
    elem_p.setAttribute('stroke-width', 1);
    elem_p.setAttribute('id', name + '-up');
    elem_p.setAttribute('class', 'wm-cls0');
    var elem_pt = document.createElementNS(defSVG, 'title');
    elem_pt.setAttribute('id', name + '-up-tip');
    elem_p.appendChild(elem_pt);
    svg_root.appendChild(elem_p);
    arrows[name + '-up'] = {};
    if (clink.up.name !== undefined) {
      arrows[name + '-up']['name'] = clink.up.name;
    } else if (clink.name !== undefined) {
      arrows[name + '-up']['name'] = clink.name + '-up';
    } else {
      arrows[name + '-up']['name'] = name + '-up';
    }
  });
}

function DrawWeathermapHistory() {
  // constract weathermap history
  var svg_hist = document.getElementById('wmhistory');
  if (svg_hist == undefined) {
    console.log("weathermap history SVG element not found.");
    return;
  }
  // reset style to default (800,300)
  svg_hist.setAttribute("width", 800);
  svg_hist.setAttribute("height", 300);
  svg_hist.setAttribute("viewBox", "0 0 800 300");
  // reset style to defined in config.json
  var fs = config.image_font + "px";
  document.getElementById("history_max").setAttribute("font-size", fs);
  document.getElementById("history_max").textContent = config.load.max;
  document.getElementById("history_min").setAttribute("font-size", fs);
  document.getElementById("history_unit").setAttribute("font-size", fs);
  document.getElementById("history_unit").textContent = config.unit;
  document.getElementById("history_start").setAttribute("font-size", fs);
  document.getElementById("history_end").setAttribute("font-size", fs);
  // legends
  var cid = 0;
  hist_color = {};
  Object.keys(arrows).forEach(function (dispid) {
    hist_color[dispid] = defHColor[cid];
    cid += 1;
    var elem_hleg = document.createElementNS(defSVG, 'text');
    elem_hleg.setAttribute("x", 710);
    elem_hleg.setAttribute("y", config.image_font * (1.0 + config.image_legend_sep) * cid);
    elem_hleg.textContent = dispid;
    elem_hleg.setAttribute("font-size", config.image_font + "px");
    elem_hleg.setAttribute("fill", hist_color[dispid]);
    svg_hist.appendChild(elem_hleg);
  });

  // start execution
  // set msec as 0 for saving length to localstorage
  curExecTime = new Date();
  curExecTime.setMilliseconds(0);
  curExecTime.setSeconds(curExecTime.getSeconds() + 1);
  if (config.data_api !== undefined) {
    window.setTimeout(LoadDataInConfig, curExecTime - Date.now());
  }
  return;
};

