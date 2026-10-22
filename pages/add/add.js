const store = require('../../utils/store')

Page({
  data: {
    type: 'expense',
    categories: [],
    category: '',
    amount: '',
    date: '',
    note: ''
  },

  onLoad: function () {
    this.setData({
      categories: store.CATEGORIES.expense,
      category: store.CATEGORIES.expense[0].name,
      date: store.formatDate(new Date())
    })
  },

  onShow: function () {
    if (!this.data.date) {
      this.setData({ date: store.formatDate(new Date()) })
    }
  },

  onSwitchType: function (e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.type) return
    const categories = store.CATEGORIES[type]
    this.setData({ type: type, categories: categories, category: categories[0].name })
  },

  onSelectCategory: function (e) {
    this.setData({ category: e.currentTarget.dataset.name })
  },

  onAmountInput: function (e) {
    this.setData({ amount: e.detail.value })
  },

  onDateChange: function (e) {
    this.setData({ date: e.detail.value })
  },

  onNoteInput: function (e) {
    this.setData({ note: e.detail.value })
  },

  onSave: function () {
    const amount = Number(this.data.amount)
    if (!amount || amount <= 0) {
      wx.showToast({ title: '请输入正确金额', icon: 'none' })
      return
    }

    store.addRecord({
      type: this.data.type,
      amount: Math.round(amount * 100) / 100,
      category: this.data.category,
      date: this.data.date,
      note: this.data.note
    })

    this.setData({ amount: '', note: '' })
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(function () {
      wx.switchTab({ url: '/pages/index/index' })
    }, 600)
  }
})
