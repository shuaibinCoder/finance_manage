const store = require('../../utils/store')

Page({
  data: {
    month: '',
    monthLabel: '',
    canNext: false,
    type: 'expense',
    total: '0',
    list: [],
    isEmpty: true,
    trend: []
  },

  onLoad: function () {
    this.setData({ month: store.getCurrentMonth() })
    this.refresh()
  },

  onShow: function () {
    if (this.data.month) this.refresh()
  },

  refresh: function () {
    const month = this.data.month
    const list = store.getRecordsByMonth(month)
    const stats = store.getCategoryStats(list, this.data.type)
    const total = stats.reduce(function (sum, item) { return sum + item.amount }, 0)
    const max = stats.length ? stats[0].amount : 0

    this.setData({
      monthLabel: store.formatMonthLabel(month),
      canNext: month < store.getCurrentMonth(),
      total: store.formatMoney(total),
      isEmpty: stats.length === 0,
      list: stats.map(function (item) {
        const meta = store.getCategoryMeta(this.data.type, item.name)
        return {
          name: item.name,
          color: meta.color,
          amountText: store.formatMoney(item.amount),
          percentText: total ? Math.round((item.amount / total) * 100) + '%' : '0%',
          barWidth: max ? Math.max((item.amount / max) * 100, 4) + '%' : '0%'
        }
      }, this),
      trend: this.buildTrend(month)
    })
  },

  buildTrend: function (month) {
    const months = []
    for (let i = 5; i >= 0; i--) {
      months.push(store.shiftMonth(month, -i))
    }
    const trend = store.getMonthlyTrend(months)
    let max = 0
    trend.forEach(function (item) {
      max = Math.max(max, item.income, item.expense)
    })

    function toHeight(value) {
      if (!value || !max) return '0%'
      return Math.max((value / max) * 100, 3) + '%'
    }

    return trend.map(function (item) {
      return {
        label: Number(item.month.split('-')[1]) + '月',
        incomeText: store.formatMoney(item.income),
        expenseText: store.formatMoney(item.expense),
        incomeHeight: toHeight(item.income),
        expenseHeight: toHeight(item.expense)
      }
    })
  },

  onSwitchType: function (e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.type) return
    this.setData({ type: type })
    this.refresh()
  },

  onPrevMonth: function () {
    this.setData({ month: store.shiftMonth(this.data.month, -1) })
    this.refresh()
  },

  onNextMonth: function () {
    if (!this.data.canNext) return
    this.setData({ month: store.shiftMonth(this.data.month, 1) })
    this.refresh()
  }
})
