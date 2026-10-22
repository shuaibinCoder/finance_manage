const store = require('../../utils/store')

Page({
  data: {
    month: '',
    monthLabel: '',
    canNext: false,
    summary: { income: '0', expense: '0', balance: '0' },
    groups: [],
    isEmpty: true
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
    const summary = store.summarize(list)
    this.setData({
      monthLabel: store.formatMonthLabel(month),
      canNext: month < store.getCurrentMonth(),
      isEmpty: list.length === 0,
      summary: {
        income: store.formatMoney(summary.income),
        expense: store.formatMoney(summary.expense),
        balance: store.formatMoney(summary.balance)
      },
      groups: this.buildGroups(list)
    })
  },

  buildGroups: function (list) {
    const map = {}
    const order = []
    list.forEach(function (item) {
      if (!map[item.date]) {
        map[item.date] = { date: item.date, items: [], income: 0, expense: 0 }
        order.push(item.date)
      }
      const amount = Number(item.amount) || 0
      if (item.type === 'income') map[item.date].income += amount
      else map[item.date].expense += amount
      const meta = store.getCategoryMeta(item.type, item.category)
      map[item.date].items.push({
        id: item.id,
        type: item.type,
        category: item.category,
        color: meta.color,
        note: item.note || '',
        amountText: (item.type === 'income' ? '+' : '-') + store.formatMoney(amount)
      })
    })

    return order.map(function (date) {
      const group = map[date]
      return {
        date: date,
        dateLabel: store.formatDateLabel(date),
        weekdayLabel: store.getWeekdayLabel(date),
        incomeText: store.formatMoney(group.income),
        expenseText: store.formatMoney(group.expense),
        items: group.items
      }
    })
  },

  onPrevMonth: function () {
    this.setData({ month: store.shiftMonth(this.data.month, -1) })
    this.refresh()
  },

  onNextMonth: function () {
    if (!this.data.canNext) return
    this.setData({ month: store.shiftMonth(this.data.month, 1) })
    this.refresh()
  },

  onAdd: function () {
    wx.switchTab({ url: '/pages/add/add' })
  },

  onLongPress: function (e) {
    const id = e.currentTarget.dataset.id
    const page = this
    wx.showModal({
      title: '删除记录',
      content: '确定要删除这条记录吗？',
      confirmColor: '#e5533d',
      success: function (res) {
        if (!res.confirm) return
        store.removeRecord(id)
        page.refresh()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
})
