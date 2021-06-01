/* global System */
import { HTMLMorph } from 'lively.morphic';
import { loadViaScript } from 'lively.resources';
import 'https://www.gstatic.com/charts/loader.js';
import L2LClient from 'lively.2lively/client.js';
import { deepMerge } from 'lively.lang/object.js';

export default class GoogleCharts extends HTMLMorph {
  static get properties () {
    return {
      chartDiv: {
        derived: true,
        get () {
          return this.domNode;
        }
      },
      gViz: {
        derived: true,
        get () {
          return window.google.visualization;
        }
      },
      gCharts: {
        derived: true,
        get () {
          return window.google.charts;
        }
      },
      chartTypes: {
        derived: true,
        get () {
          let result = Object.keys(this.chartTypeRecords);
          return result.sort();
        }
      },
      chartData: {
        defaultValue: null
      },
      chartView: { defaultValue: null },
      chartOptions: { defaultValue: null },
      chartType: {
        type: 'Enum',
        values: [
          'annotationChart', 'areaChart', 'barChart', 'bubbleChart', 'candlestickChart',
          'columnChart', 'comboChart', 'gantt', 'histogram', 'lineChart', 'orgChart', 'pieChart',
          'sankeyChart', 'scatterChart', 'steppedAreaChart', 'timeline', 'treeMap', 'wordTree'
        ],
        defaultValue: 'pieChart'
      },
      defaultHTML: {
        derived: true,
        get () {
          return `<div id="chart-container-${this.id}"></div>`;
        }
      }
    };
  }

  get services () {
    let self = this;
    return {
      '[el-jupyter] message' (tracker, { sender, data }, ackFn, socket) {
        self.updateFrom(data);
      }
    };
  }

  args () {
    let result = {};

    let location = window.location;
    let search = location ? location.search : null;
    let params = search ? search.substr(1).split('&') : [];

    params.forEach(paramString => {
      let parsed = paramString.split('=');
      if (parsed.length == 2) {
        result[parsed[0]] = parsed[1];
      }
    });
    return result;
  }

  async setupL2L () {
    let me = L2LClient.forLivelyInBrowser();
    this.client = me;
    // let me = L2LClient.default()
    let self = this;

    me.whenRegistered().then(async () => {
      let room = this.args().room ? this.args().room : 'DefaultRoom';
      if (room == 'DefaultRoom') {
        console.warn('No Room Supplied');
        return;
      }
      console.log('jupyter client registered');
      let { data: { joined } } = await me.joinRoom(room);
      if (joined) {
        console.log(`client joined ${room}`);
      }
    }    );
    me.addServices(this.services);
  }

  async onLoad () {
    await this.whenRendered();
    await this.loadGoogleChartPackages();
    this.setupL2L();
    this.gCharts.setOnLoadCallback(() => {
      this.loadEditor(this);
      this.redrawChart();
    });
  }

  async loadGoogleChartPackages (packageList = ['corechart', 'map', 'charteditor']) {
    await this.gCharts.load('current', { packages: packageList, mapsApiKey: 'AIzaSyA4uHMmgrSNycQGwdF3PSkbuNW49BAwN1I' });
  }

  loadEditor (wrapData = {}) {
    this.chartEditor = new this.gViz.ChartEditor();
    this.gViz.events.addListener(this.chartEditor, 'ok', () => {
      this.redrawChart(this.chartEditor.getChartWrapper(this.chartDiv));
    });
  }

  openEditor () {
    let target = this;
    let dataTable;
    if (Array.isArray(target.chartData)) {
      dataTable = target.gViz.arrayToDataTable(target.chartData);
    } else {
      dataTable = new target.gViz.DataTable(target.chartData);
    }
    let wrapper = new target.gViz.ChartWrapper({
      dataTable,
      options: target.chartOptions,
      chartView: target.chartView,
      chartType: target.chartType
    });
    target.chartEditor.openDialog(wrapper, {});
  }

  updateFrom (data) {
    if (data.eventType == 'draw') {
      if (data.payload.streaming) {
        data.payload.data = this.streamingGraph(data.payload.data, data.payload.streaming);
      }
      this.chartData = data.payload.data ? data.payload.data : this.chartData;
      if (data.payload.options) {
        this.chartOptions = deepMerge(this.chartOptions, data.payload.options);
      }
      this.chartView = data.payload.chartView ? data.payload.chartView : this.chartView;
      // this.chartOptions = data.payload.options ? data.payload.options : this.chartOptions;
      this.chartType = data.payload.chartType ? data.payload.chartType : this.chartType;
      this.redrawChart();
    } else if (data.eventType == 'updateGraph') {
      this.redrawChart();
    } else if (data.eventType == 'debug') {
      this.debug(data);
    }
  }

  streamingGraph (data, streaming) {
    if (streaming.setup) {
      this.streaming = streaming;
      this.chartData = data;
    }
    let { maxElements } = this.streaming;
    let dataTable;
    if (Array.isArray(this.chartData)) {
      dataTable = this.gViz.arrayToDataTable(this.chartData);
    } else {
      dataTable = new this.gViz.DataTable(this.chartData);
    }
    if (!streaming.setup) {
      dataTable.addRows(data);
    }
    while (maxElements && dataTable.getNumberOfRows() >= maxElements) {
      dataTable.removeRow(0);
    }
    return dataTable.toJSON();
  }

  async redrawChart (wrapper) {
    if (!this.chartOptions || !this.chartData) {
      throw new Error('Options and/or Data not defined');
      return;
    }
    if (wrapper) {
      this.chartData = JSON.parse(wrapper.getDataTable().toJSON());
      this.chartOptions = wrapper.getOptions();
      this.chartType = wrapper.getChartType();
      this.chartView = wrapper.getView();
      this.client.broadcast(this.args().room, '[el-jupyter] message', {
        payload: {
          data: this.chartData,
          options: this.chartOptions,
          chartType: this.chartType,
          chartView: this.chartView
        },
        eventType: 'draw'
      });
    }

    let dataTable;
    if (Array.isArray(this.chartData)) {
      dataTable = this.gViz.arrayToDataTable(this.chartData);
    } else {
      dataTable = new this.gViz.DataTable(this.chartData);
    }

    wrapper = new this.gViz.ChartWrapper();

    wrapper.setOptions(this.chartOptions);
    wrapper.setDataTable(dataTable);
    wrapper.setView(this.chartView);
    wrapper.setChartType(this.chartType);

    wrapper.setOption('height', this.height);
    wrapper.setOption('width', this.width);
    // wrapper.setOptions({title: "This is a test"})
    wrapper.draw(this.chartDiv);
  }

  makeOptions (opts = {}) {
    function mergeDeep (target, source) {
      const isObject = (obj) => obj && typeof obj === 'object';

      if (!isObject(target) || !isObject(source)) {
        return source;
      }

      Object.keys(source).forEach(key => {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
          target[key] = targetValue.concat(sourceValue);
        } else if (isObject(targetValue) && isObject(sourceValue)) {
          target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue);
        } else {
          target[key] = sourceValue;
        }
      });

      return target;
    }

    let options = {
      title: 'engageLively Chart',
      backgroundColor: '#333333',
      textStyle: { color: 'white' },
      titleTextStyle: { color: 'white' },
      chartArea: {
        width: '50%',
        backgroundColor: '#333333'
      },
      legend: {
        textStyle: {
          color: 'white'
        }
      },
      hAxis: {
        title: 'x',
        textStyle: { color: 'white' },
        titleTextStyle: { color: 'white' }
      },
      vAxis: {
        title: 'y',
        textStyle: { color: 'white' },
        titleTextStyle: { color: 'white' }
      },
      vAxes: [
        {
          title: 'null',
          textStyle: null,
          titleTextStyle: null,
          minValue: null,
          maxValue: null,
          viewWindow: {
            max: null,
            min: null
          },
          useFormatFromData: true
        },
        {
          viewWindow: {
            textStyle: { color: 'white' },
            titleTextStyle: { color: 'white' },
            max: null,
            min: null
          },
          minValue: null,
          maxValue: null,
          useFormatFromData: true
        }],
      colors: ['#FF6663', '#CC99C9', '#FEB144', '#FDFD97', '#9EE09E', '#9EC1CF', '#CC99C9'],
      width: this.width,
      height: this.height
    };

    options = mergeDeep(options, opts);
    return options;
  }

  async publish () {
    let { interactivelyFreezePart } = await System.import('lively.freezer/index.js');
    return await interactivelyFreezePart(this);
  }

  setData (data) {
    this.chartData = data;
  }

  setOptions (opts, replace) {
    if (!replace) {
      this.chartOptions = deepMerge(this.chartOptions, opts);
    } else {
      this.chartOptions = opts;
    }
  }

  drawGraph () {
    let chart = this;
    let opts = chart.chartOptions;
    let type = chart.chartType;
    let data = chart.chartData;

    let wrapper = new this.gViz.ChartWrapper({
      chartType: type,
      dataTable: data,
      options: opts
    });
    wrapper.draw(chart.chartDiv);
  }

  mergeDeep (target, source) {
    const isObject = (obj) => obj && typeof obj === 'object';

    if (!isObject(target) || !isObject(source)) {
      return source;
    }

    Object.keys(source).forEach(key => {
      const targetValue = target[key];
      const sourceValue = source[key];

      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        target[key] = targetValue.concat(sourceValue);
      } else if (isObject(targetValue) && isObject(sourceValue)) {
        target[key] = this.mergeDeep(Object.assign({}, targetValue), sourceValue);
      } else {
        target[key] = sourceValue;
      }
    });

    return target;
  }

  debug (data) {
    console.log(data);
  }
}
