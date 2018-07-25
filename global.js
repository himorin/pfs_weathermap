var def_configfile = "config.json";
var def_SVG = 'http://www.w3.org/2000/svg';
var def_Xlink = 'http://www.w3.org/1999/xlink';

var def_config = {
  arrow : { width : 5, head : 10 },
};
var grafana_url = "https://pfs.ipmu.jp/grafana/api/datasources/proxy/1/api/v1/query";

var disp_pair = {};

function ShowError (str) {
  console.log('Error occured: ' + str);
}

function ParseData (json) {
  if (json['status'] != 'success') {
    ShowError('grafana query status: ' + json['status']);
    return undef;
  }
  var ret = {};
  if (json['data']['result'].length < 0) {
    ShowError('No data acquired from grafana');
    return undef;
  }
  var time = json['data']['result'][0]['value'][0];
  json['data']['result'].forEach(function(elem) {
    ret[elem['metric']['instance'] + '-' + elem['metric']['ifIndex']]
      = elem['value'][1];
  }, false);
  return ret;
}

function PathAvg(p0, p1) {
  return {'x': ((p0.x + p1.x) / 2.0), 'y': ((p0.y + p1.y) / 2.0)};
}
function PathVec(p0, p1) {
  var len = PathLen(p0, p1);
  return {'x': ((p1.x - p0.x) / len), 'y': ((p1.y - p0.y) / len)};
}

function SetArrays (svg_root, dat) {
  Object.keys(dat).forEach(function (name) {
    var clink = dat[name];
    clink.mid = PathAvg(clink.up, clink.down);
    clink.vec = PathVec(clink.up, clink.down);
    var len_arr = PathLen(clink.up, clink.down) / 2.0 - config.arrow.head;
    var cvec = clink.vec;
    var len_hw = config.arrow.width / 2.0;
    var len_hd = config.arrow.head;

    // down (from up end to mid)
    var elem_p = document.createElementNS(def_SVG, 'path');
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
    var elem_pt = document.createElementNS(def_SVG, 'title');
    elem_pt.setAttribute('id', name + '-down-tip');
    elem_p.appendChild(elem_pt);
    svg_root.appendChild(elem_p);
    arrows[name + '-down'] = {};
    if (clink.down.name !== undefined) {
      arrows[name + '-down']['name'] = clink.down.name;
    } else {
      arrows[name + '-down']['name'] = name + '-down';
    }
    // up (from down end to mid)
    var elem_p = document.createElementNS(def_SVG, 'path');
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
    var elem_pt = document.createElementNS(def_SVG, 'title');
    elem_pt.setAttribute('id', name + '-up-tip');
    elem_p.appendChild(elem_pt);
    svg_root.appendChild(elem_p);
    arrows[name + '-up'] = {};
    if (clink.up.name !== undefined) {
      arrows[name + '-up']['name'] = clink.up.name;
    } else {
      arrows[name + '-up']['name'] = name + '-up';
    }
  });
}

function SetDataToDisplay (json) {
}

function ParseConfig (json) {
}

window.addEventListener('load', function(event) {
  // get config and store
  fetch(def_configfile, {
    cache: 'no-cache', credentials: 'same-origin', method: 'GET', 
    redirect: 'follow' })
  .then(function(response) {
    if (response.ok) {return response.json(); }
    throw Error('Returned response for config' + response.status);
  }).then(function(json) {
    ParseConfig(json);
  }).catch(function(error) {
    ShowError(error.message);
  });
});

