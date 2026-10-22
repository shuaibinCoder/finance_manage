const RECORDS_KEY = 'finance_records_v1'

const CATEGORIES = {
  expense: [
    { name: '餐饮', color: '#FF7A45' },
    { name: '交通', color: '#36CFC9' },
    { name: '购物', color: '#9254DE' },
    { name: '居住', color: '#597EF7' },
    { name: '娱乐', color: '#F759AB' },
    { name: '医疗', color: '#73D13D' },
    { name: '学习', color: '#FFA940' },
    { name: '其他', color: '#8C8C8C' }
  ],
  income: [
    { name: '工资', color: '#36CFC9' },
    { name: '奖金', color: '#FFA940' },
    { name: '投资', color: '#597EF7' },
    { name: '兼职', color: '#73D13D' },
    { name: '红包', color: '#F759AB' },
    { name: '其他', color: '#8C8C8C' }
  ]
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function getRecords() {
  try {
    const list = wx.getStorageSync(RECORDS_KEY)
    return Object.prototype.toString.call(list) === '[object Array]' ? list : []
  } catch (e) {
    return []
  }
}

function setRecords(list) {
  wx.setStorageSync(RECORDS_KEY, list)
}

function addRecord(record) {
  const list = getRecords()
  const item = Object.assign({}, record, {
    id: Date.now() + '_' + Math.floor(Math.random() * 100000),
    createdAt: Date.now()
  })
  list.push(item)
  setRecords(list)
  return item
}

function removeRecord(id) {
  const list = getRecords()
  const next = list.filter(function (item) { return item.id !== id })
  setRecords(next)
  return next
}

function formatDate(date) {
  const d = date || new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function getCurrentMonth() {
  return formatDate(new Date()).slice(0, 7)
}

function shiftMonth(month, delta) {
  const parts = String(month || '').split('-')
  const year = Number(parts[0])
  const mon = Number(parts[1])
  const d = new Date(year, mon - 1 + delta, 1)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1)
}

function getRecordsByMonth(month) {
  const list = getRecords().filter(function (item) {
    return String(item.date || '').slice(0, 7) === month
  })
  return list.sort(function (a, b) {
    if (a.date === b.date) return (b.createdAt || 0) - (a.createdAt || 0)
    return a.date < b.date ? 1 : -1
  })
}

function summarize(list) {
  let income = 0
  let expense = 0
  ;(list || []).forEach(function (item) {
    const amount = Number(item.amount) || 0
    if (item.type === 'income') income += amount
    else expense += amount
  })
  return { income: income, expense: expense, balance: income - expense }
}

function getCategoryStats(list, type) {
  const map = {}
  ;(list || []).forEach(function (item) {
    if (item.type !== type) return
    const amount = Number(item.amount) || 0
    map[item.category] = (map[item.category] || 0) + amount
  })
  return Object.keys(map).map(function (name) {
    return { name: name, amount: map[name] }
  }).sort(function (a, b) { return b.amount - a.amount })
}

function getMonthlyTrend(months) {
  return (months || []).map(function (month) {
    const summary = summarize(getRecordsByMonth(month))
    return { month: month, income: summary.income, expense: summary.expense }
  })
}

function getCategoryMeta(type, name) {
  const list = CATEGORIES[type] || []
  for (let i = 0; i < list.length; i++) {
    if (list[i].name === name) return list[i]
  }
  return { name: name, color: '#8C8C8C' }
}

function formatMoney(value) {
  const num = Math.round((Number(value) || 0) * 100) / 100
  return num.toFixed(2)
}

function formatMonthLabel(month) {
  const parts = String(month || '').split('-')
  if (parts.length !== 2) return month
  return parts[0] + '年' + Number(parts[1]) + '月'
}

function formatDateLabel(date) {
  const parts = String(date || '').split('-')
  if (parts.length !== 3) return date
  return Number(parts[1]) + '月' + Number(parts[2]) + '日'
}

function getWeekdayLabel(date) {
  const today = formatDate(new Date())
  if (date === today) return '今天'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (date === formatDate(yesterday)) return '昨天'
  const parts = String(date || '').split('-')
  if (parts.length !== 3) return ''
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return week[new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getDay()]
}

module.exports = {
  CATEGORIES: CATEGORIES,
  getRecords: getRecords,
  setRecords: setRecords,
  addRecord: addRecord,
  removeRecord: removeRecord,
  getRecordsByMonth: getRecordsByMonth,
  summarize: summarize,
  getCategoryStats: getCategoryStats,
  getMonthlyTrend: getMonthlyTrend,
  getCategoryMeta: getCategoryMeta,
  formatMoney: formatMoney,
  formatDate: formatDate,
  getCurrentMonth: getCurrentMonth,
  shiftMonth: shiftMonth,
  formatMonthLabel: formatMonthLabel,
  formatDateLabel: formatDateLabel,
  getWeekdayLabel: getWeekdayLabel
}
