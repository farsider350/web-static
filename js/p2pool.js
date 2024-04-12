const default_config = {
  myself: [],
    host: '',
    reload_interval: 30,
    reload_chart_interval: 600,
    header_content_url: '',
    theme: 'cyborg',
    available_themes: [
      'default',
      'amelia',
      'cerulean',
      'cosmo',
      'cyborg',
      'darkly',
      'flatly',
      'journal',
      'lumen',
      'readable',
      'simplex',
      'slate',
      'spacelab',
      'superhero',
      'united',
      'yeti'
    ]
};
config = { ...default_config, ...config };

let currency;
let set_currency_symbol = true;
const p2pool_data = {}

// ==================================================================
// event handlers

$(document).ready(() => {
  $(document).trigger('init');

  if (config.header_content_url && config.header_content_url.length > 0) {
    $("#header_content").load(config.header_content_url);
  }
});

// toggle hashrate chart
$('#hour.hashrate').click(() => { fetchGraph('hour') });
$('#day.hashrate').click(() => { fetchGraph('day') });
$('#week.hashrate').click(() => { fetchGraph('week') });
$('#month.hashrate').click(() => { fetchGraph('month') });
$('#year.hashrate').click(() => { fetchGraph('year') });

$('#setminers.btn').click(() => { setMyMiners() });

// ==================================================================

const fetchCurrencyInfo = async () => {
  const resp = await fetch(new URL('/web/currency_info', config.host), { cache: 'no-cache' });
  p2pool_data['currency_info'] = await resp.json();
};

const fetchData = async () => {
  // URL Segment => p2pool_data[key]
  const p2pool_map = {
    '/rate': 'rate',
    '/local_stats': 'local_stats',
    '/current_payouts': 'current_payouts',
    '/global_stats': 'global_stats',
    '/recent_blocks': 'recent_blocks'
  }

  for (const segment in p2pool_map) {
    const resp = await fetch(new URL(segment, config.host), { cache: 'no-cache' });
    p2pool_data[p2pool_map[segment]] = await resp.json();
  }

  $(document).trigger('update_currency');
  $(document).trigger('update_miners');
  $(document).trigger('update_time');
  $(document).trigger('update_blocks');
};

const fetchGraph = async (interval) => {
  if (! interval) {
    interval = localStorage.getItem('graph_type') || 'day';
  }

  const graph_hashrate = [], graph_doa_hashrate = [], graph_blocks = [];

  const hash_response = await fetch(new URL(`/web/graph_data/local_hash_rate/last_${interval}`, config.host), { cache: 'no-cache' });
  const doa_hash_response = await fetch(new URL(`/web/graph_data/local_dead_hash_rate/last_${interval}`, config.host), { cache: 'no-cache' });

  const hashrate_data = await hash_response.json();
  const doa_hashrate_data = await doa_hash_response.json();

  for (const key in hashrate_data) {
    const value = hashrate_data[key];

    const el = [];
    el.push(parseInt(value[0]) * 1000, parseFloat(value[1]));
    graph_hashrate.push(el);
  }
  graph_hashrate.sort();

  for (const key in doa_hashrate_data) {
    const value = doa_hashrate_data[key];

    const el = [];
    el.push(parseInt(value[0]) * 1000, parseFloat(value[1]));
    graph_doa_hashrate.push(el);
  }
  graph_doa_hashrate.sort();

  for (const block of p2pool_data['recent_blocks']) {
    const el = [];
    el.push(parseInt(block["ts"]) * 1000);
    graph_blocks.push(el);
  }

  localStorage.setItem('graph_type', interval)
  draw(graph_hashrate, graph_doa_hashrate, graph_blocks, 'chart', interval);
};

const setMyMiners = () => {
  localStorage.miners = $('#myminers').val();
  localStorage.onlyclientminers = $('#onlymyminers').prop('checked');
  $(document).trigger('update_miners');
};

const fetchMyMiners = () => {
  $('#myminers').val(localStorage.miners);
  $('#onlymyminers').prop('checked', localStorage.onlyclientminers == 'true' ? true : false);
};

const initThemes = () => {
  localStorage.theme = localStorage.theme || 'cyborg';

  for (const theme of config.available_themes) {
    const li = $('<li>');
    const a = $('<a>').text(theme)

    li.click(function() {
      $(this).addClass('active').siblings().removeClass('active');
      localStorage.theme = $(this).text().trim();
      changeTheme(localStorage.theme);
    });

    if (theme === localStorage.theme) {
      li.addClass('active')
      changeTheme(localStorage.theme)
    }

    li.append(a)
    $('#theme-list').append(li)
  }
};
const changeTheme = (theme) => {
  $('#theme').attr('href', 'css/bootstrap-' + theme.toLowerCase().trim() + '.min.css');
};

// ==================================================================
// custom event handlers

// init

$(document).on('update', fetchData);
$(document).on('update_graph', fetchGraph);

$(document).on('init', async () => {
  setInterval(() => { $(document).trigger('update'); }, config.reload_interval * 1000);

  fetchMyMiners();
  initThemes();
  fetchCurrencyInfo();

  $(document).trigger('update');
});

// Fills the list of active miners on this node.  I know, there are
// zillions of people out there on p2pool.  But I'm typically only
// interested to see, who is mining on my node.
$(document).on('update_miners', () => {
  const local_stats = p2pool_data['local_stats'];
  const global_stats = p2pool_data['global_stats'];
  const current_payouts = p2pool_data['current_payouts'];
  const currency_info = p2pool_data['currency_info'];

  let local_hashrate = 0;
  let local_doa_hashrate = 0;

  // Sort by hashrate, highest first
  const miners = sortByValue(local_stats.miner_hash_rates).reverse();
  const clientMiners = (localStorage.miners && localStorage.miners.length > 0) ? localStorage.miners.split("\n") : [];

  $('#active_miners').find("tr:gt(0)").remove();
  $.each(miners, (_, address) => {
    // Only display client miners if configured
    if (localStorage.onlyclientminers === 'true' && $.inArray(address, clientMiners) == -1) {
      return true;
    }

    const hashrate = local_stats.miner_hash_rates[address];
    const tr = $('<tr/>').attr('id', address);

    // Highlight client miner if configured
    if (localStorage.miners && localStorage.miners.length > 0 && $.inArray(address, clientMiners) >= 0) {
      tr.addClass('success');
    }
    // Highlight server miner if configured
    if (config.myself && config.myself.length > 0 && $.inArray(address, config.myself) >= 0) {
      tr.addClass('warning');
    }

    const address_span = $('<span/>').addClass('coin_address').text(address);
    const link_icon = $('<i/>').addClass('fa fa-external-link fa-fw');
    const blockinfo = $('<a/>')
      .attr('href', currency_info.address_explorer_url_prefix + address)
      .attr('target', '_blank').append(link_icon);

    const doa = local_stats.miner_dead_hash_rates[address] || 0;
    const doa_prop = (parseFloat(doa) / parseFloat(hashrate)) * 100;

    local_hashrate += hashrate || 0;
    local_doa_hashrate += doa || 0;

    tr.append($('<td/>')
      .addClass('text-left')
      .append(address_span)
      .append('&nbsp;')
      .append(blockinfo)
    );
    tr.append($('<td/>')
      .addClass('text-right')
      .append(formatHashrate(hashrate))
    );
    tr.append($('<td/>')
      .addClass('text-right')
      .append(formatHashrate(doa) + ' (' + doa_prop.toFixed(2) + '%)')
    );

    // Miner Last Difficulties is non-standard p2pool data
    // Handle with care
    /*if (local_stats.miner_last_difficulties) {
      const diff = local_stats.miner_last_difficulties ? (parseFloat(local_stats.miner_last_difficulties[address]) || 0) : 0;
      const time_to_share = (parseInt(local_stats.attempts_to_share) / parseInt(hashrate) * (diff / parseFloat(global_stats.min_difficulty))) || 0;

      if ($("#active_miners th:contains('Share Difficulty')").length == 0) {
        const share_diff_col = $('<th/>')
          .addClass('text-right')
          .text('Share Difficulty');
        const time_to_share_col = $('<th/>')
          .addClass('text-right')
          .text('Time to Share');

        $('#active_miners thead tr')
          .children(":eq(2)")
          .after(time_to_share_col)
          .after(share_diff_col);
      }

      tr.append($('<td/>')
        .addClass('text-right')
        .append(diff.toFixed(3) + ' (' + formatInt(diff * 65536) + ')')
      );
      tr.append($('<td/>')
        .addClass('text-right')
        .append(formatSeconds(time_to_share))
      );
    }*/
    const totalHash = Object.values(local_stats.miner_hash_rates).reduce((acc, val) => acc + parseFloat(val || 0), 0);
    const totalNetHash = global_stats.pool_hash_rate;
/*$('.text-right').each(function() {
    const payoutValue = parseFloat($(this).text());
    if (!isNaN(payoutValue)) {
        const percentage = (payoutValue / totalPayout) * 10000;
        $(this).text(percentage.toFixed(2) + 'DOGE');
    }
});*/

    const payoutAddress = address.split('.')[0];
    const payout = current_payouts[payoutAddress] || 0;
    

    const localValue = (hashrate / totalHash) * local_stats.block_value;
    const payoutValue = (payout / localValue) * 10000;

    if (payout) {
      const td = $('<td/>').attr('class', 'text-right')
        .text(parseFloat(payout).toFixed(6) + ' DGB ' + payoutValue.toFixed(2) + ' DOGE ' + payoutValue.toFixed(0) + ' DINGO')
      tr.append(td);
    }
    else {
      tr.append($('<td/>').attr('class', 'text-right')
        .append($('<i/>').append('no shares yet')));
    }
    

    $('#active_miners').append(tr);
  });
  $.bootstrapSortable({ applyLast: true });

  let doa_rate = 0;
  if (local_doa_hashrate !== 0 && local_hashrate !== 0) {
    doa_rate = (local_doa_hashrate / local_hashrate) * 100;
  }

  const rate = formatHashrate(local_hashrate)
    + ' (Rejected '
    + formatHashrate(local_doa_hashrate)
    + ' / ' + doa_rate.toFixed(2)
    + '%)';
  $('#local_rate').text(rate);

  const efficiency = parseFloat(local_stats.efficiency * 100).toFixed(2);
  $('#local_efficiency').text(`${efficiency}%`);

  const pool_hash_rate = parseInt(global_stats.pool_hash_rate || 0);
  const pool_nonstale_hash_rate = parseInt(global_stats.pool_nonstale_hash_rate || 0);
  const global_doa_rate = pool_hash_rate - pool_nonstale_hash_rate;

  const global_rate = formatHashrate(pool_hash_rate)
    + ' (Rejected '
    + formatHashrate(global_doa_rate)
    + ' / ' + ((global_doa_rate / pool_hash_rate) * 100).toFixed(2)
    + '%)';
  $('#global_rate').text(global_rate);

  // Network Hash Rate information is non-standard p2pool data
  // Handle with care
  if (global_stats.network_hashrate) {
    //<li class="list-group-item">Network Hashrate: <span class="network_rate"></span></li>
    if ($(".status li:contains('Network Hashrate')").length == 0) {
      // Add network hashrate bar to status area if it doesn't already exist
      const nethash_row = $('<li/>')
        .addClass('list-group-item')
        .text('Network Hashrate: ')
        .append($('<span/>').addClass('network_rate'));
      $('.status.rate_info').prepend(nethash_row);
    }

    const network_rate = formatHashrate(global_stats.network_hashrate);
    $('.network_rate').text(network_rate);
  }

  // Network Block Diff information is non-standard p2pool data
  // Handle with care
  if (global_stats.network_block_difficulty) {
    // Add diff button to the navbar if it doesn't already exist
    if ($('button .diff').length == 0) {
      const diff_button = $('<button/>')
        .attr('type', 'button')
        .addClass('btn navbar-btn btn-default btn-sm')
        .text('Diff: ')
        .append($('<span/>').addClass('diff'));
      $('.navbar-right').children(":eq(1)").after(diff_button);
    }
    // Add diff bar to status area if it doesn't already exist
    if ($(".status li:contains('Network Block Difficulty')").length == 0) {
      const diff_row = $('<li/>')
        .addClass('list-group-item')
        .text('Network Block Difficulty: ')
        .append($('<span/>').addClass('diff'));
      $('.status.share_info').children(':eq(1)').after(diff_row);
    }

    $('.diff').text(parseFloat(global_stats.network_block_difficulty).toFixed(8));
  }

  $('#share_difficulty').text(parseFloat(global_stats.min_difficulty).toFixed(8));

  $('#block_value')
    .text(parseFloat(local_stats.block_value).toFixed(8))
    .append(' ').append(currency.clone());

  if (local_stats.donation_proportion <= 0) {
    $('#node_donation').parent().hide();
  }
  else {
    $('#node_donation').parent().show();
    $('#node_donation').text((local_stats.donation_proportion * 100) + '%');
  }

  $('#node_fee').text(local_stats.fee + '%');
  $('#p2pool_version').text(local_stats.version);
  $('#protocol_version').text(local_stats.protocol_version);
  $('#peers_in').text(local_stats.peers.incoming);
  $('#peers_out').text(local_stats.peers.outgoing);
  $('#node_uptime').text(formatSeconds(local_stats.uptime));

  // Get the current date
  var currentDate = new Date();

  // Set the target date (April 3, 2024)
  var targetDate = new Date(2024, 3, 3); // Note: Months are zero-based in JavaScript, so 3 represents April

  // Calculate the difference in milliseconds between the current date and the target date
  var timeDifference = currentDate - targetDate;

  // Convert milliseconds to seconds
  var uptimeInSeconds = Math.abs(timeDifference) / 1000;

  // Format the uptime
  $('#total_uptime').text(formatSeconds(uptimeInSeconds));

  if (local_stats.warnings.length > 0) {
    $('#node_alerts').empty();

    $.each(local_stats.warnings, (key, warning) => {
      $('#node_alerts').append($('<p/>').append(warning));
    });

    $('#node_alerts').fadeIn(1000, function() {
      $(this).removeClass('hidden');
    });
  }
  else {
    if (!$('#node_alerts').hasClass('hidden')) {
      $('#node_alerts').fadeOut(1000, function() {
        $(this).addClass('hidden');
      });
    }
  }

  $('#shares')
    .text('Total: ' + local_stats.shares.total
      + ' (Orphan: ' + local_stats.shares.orphan
      + ', Dead: ' + local_stats.shares.dead + ')');

  if (local_hashrate !== 0) {
    const time_to_share = (parseInt(local_stats.attempts_to_share) / parseInt(local_hashrate));
    $('#expected_time_to_share').text(formatSeconds(time_to_share));
  }
  else {
    $('#expected_time_to_share').html('&dash;');
  }

  const attempts_to_block = parseInt(local_stats.attempts_to_block || 0);
  const time_to_block = attempts_to_block / pool_hash_rate;
  $('#expected_time_to_block').text(formatSeconds(time_to_block));
  const time_to_local_block = attempts_to_block / local_hashrate;
  const time_to_doge = time_to_local_block * 20;
  $('#expected_time_to_doge').text(formatSeconds(time_to_doge));
});

// Fills the recent block table
$(document).on('update_blocks', () => {
  const recent_blocks = p2pool_data['recent_blocks'];

  $('#recent_blocks').find('tbody tr').remove();

  $.each(recent_blocks, (key, block) => {
    const ts = block.ts;
    const num = block.number;
    const hash = block.hash;

    // link to blockchain.info for the given hash
    const blockinfo = $('<a/>')
      .attr('href', p2pool_data['currency_info'].block_explorer_url_prefix + hash)
      .attr('target', '_blank').text(num);

    const tr = $('<tr/>').attr('id', num);
    tr.append($('<td/>').append($.format.prettyDate(new Date(ts * 1000))));
    tr.append($('<td/>').append($.format.date(new Date(ts * 1000))));
    tr.append($('<td/>').append(blockinfo));
    $('#' + num).remove();
    $('#recent_blocks').append(tr);
  });

  if (recent_blocks[0] != null && recent_blocks[0].ts != null) {
    $('#last_block').text($.format.prettyDate(new Date(recent_blocks[0].ts * 1000)));
  }
  else {
    $('#last_block').text('none yet');
  }
});

$(document).on('update_shares', () => {
  const recent_blocks = p2pool_data['recent_blocks'];

  $.each(recent_blocks, (key, block) => {
    const ts = block.ts;
    const num = block.number;
    const hash = block.hash;

    // link to blockchain.info for the given hash
    const blockinfo = $('<a/>')
      .attr('href', p2pool_data['currency_info'].block_explorer_url_prefix + hash)
      .attr('target', '_blank').text(hash);

    const tr = $('<tr/>').attr('id', num);
    tr.append($('<td/>').append($.format.prettyDate(new Date(ts * 1000))));
    tr.append($('<td/>').append(num));
    tr.append($('<td/>').append(blockinfo));
    tr.append($('<td/>').html('&dash;'));
    $('#recent_blocks').append(tr);
  });
});

// Place the currency symbol for the currency the node is mining.  If
// it's Bitcoin, use the fontawesome BTC icon
$(document).on('update_currency', () => {
  const currency_info = p2pool_data['currency_info'];

  if (currency_info.symbol === 'BTC') {
    // use fontawesome BTC symbol
    currency = $('<i/>').attr('class', 'fa fa-btc fa-fw');
  }
  else {
    currency = $('<span/>').append(currency_info.symbol);
  }

  if (set_currency_symbol) {
    $('#currency').append('(').append(currency).append(')');
    set_currency_symbol = false;
  }
});

// Updates the 'Updated:' field in page header
$(document).on('update_time', () => {
  const dts = $.format.date(new Date(), 'yyyy-MM-dd hh:mm:ss p');
  $('#updated').text(dts);
});

// Manage graph modal data
$('#hashgraph').on('shown.bs.modal', () => {
  p2pool_data['graph_interval'] = setInterval(() => {
    $(document).trigger('update_graph');
  }, config.reload_chart_interval * 1000);

  $(document).trigger('update_graph');
});
$('#hashgraph').on('hidden.bs.modal', () => {
  clearInterval(p2pool_data['graph_interval']);
  delete p2pool_data['graph_interval'];
});
