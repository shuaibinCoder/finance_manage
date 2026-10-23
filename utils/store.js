const reportUtils = require('./report')

const STORAGE_KEY = 'financial_report_mvp_v1'

function defaultState() {
  return {
    version: 1,
    user: { displayName: '微信用户', avatarFileId: '', profileCompleted: false },
    company: null,
    activeMonth: reportUtils.currentMonth(),
    reports: {}
  }
}

function getState() {
  try {
    const state = wx.getStorageSync(STORAGE_KEY)
    if (!state || Object.prototype.toString.call(state) !== '[object Object]') return defaultState()
    return Object.assign(defaultState(), state, {
      reports: state.reports || {}
    })
  } catch (error) {
    return defaultState()
  }
}

function saveState(state) {
  wx.setStorageSync(STORAGE_KEY, state)
  return state
}


function getUser() {
  return getState().user || { displayName: '微信用户', avatarFileId: '', profileCompleted: false }
}


function cacheUser(user) {
  const state = getState()
  state.user = user ? Object.assign({}, user) : getUser()
  saveState(state)
  return state.user
}

function saveUserProfile(profile) {
  const state = getState()
  state.user = Object.assign({}, getUser(), profile, { profileCompleted: true, updatedAt: Date.now() })
  saveState(state)
  return state.user
}

function getSession() {
  const state = getState()
  return {
    user: state.user || getUser(),
    company: state.company,
    membership: state.company ? {
      id: 'local_owner',
      companyId: state.company.id,
      role: 'owner',
      roleLabel: '企业管理员',
      status: 'active'
    } : null
  }
}

function listMembers() {
  const session = getSession()
  if (!session.company) return []
  return [{
    id: 'local_owner',
    displayName: session.user.displayName || '微信用户',
    avatarFileId: session.user.avatarFileId || '',
    role: 'owner',
    roleLabel: '企业管理员',
    isSelf: true,
    joinedAt: session.company.createdAt || Date.now()
  }]
}

function getCompany() {
  return getState().company
}

function setCompany(company) {
  const state = getState()
  state.company = Object.assign({}, state.company || {}, company, {
    id: company.id || (state.company && state.company.id) || 'company_' + Date.now(),
    updatedAt: Date.now()
  })
  saveState(state)
  return state.company
}


function cacheCompany(company) {
  const state = getState()
  state.company = company ? Object.assign({}, company) : null
  saveState(state)
  return state.company
}

function cacheReport(report) {
  if (!report || !report.month) return report
  const state = getState()
  const cached = Object.assign({}, report)
  delete cached._exists
  state.reports[report.month] = cached
  saveState(state)
  return report
}

function cacheReports(reports) {
  const state = getState()
  ;(reports || []).forEach(function (report) {
    if (!report || !report.month) return
    const cached = Object.assign({}, report)
    delete cached._exists
    state.reports[report.month] = cached
  })
  saveState(state)
  return reports
}

function getActiveMonth() {
  return getState().activeMonth || reportUtils.currentMonth()
}

function setActiveMonth(month) {
  const state = getState()
  state.activeMonth = month
  saveState(state)
}

function normalizeReport(saved, month) {
  const empty = reportUtils.createEmptyReport(month)
  if (!saved) return empty
  return Object.assign(empty, saved, {
    month: month,
    balance: Object.assign({}, empty.balance, saved.balance || {}),
    profit: Object.assign({}, empty.profit, saved.profit || {})
  })
}

function getReport(month) {
  const state = getState()
  return normalizeReport(state.reports[month], month)
}

function saveReport(report) {
  const state = getState()
  const month = report.month
  const previous = state.reports[month]
  const next = normalizeReport(report, month)
  next.updatedAt = Date.now()
  next.version = previous ? (Number(previous.version) || 1) + 1 : 1
  state.reports[month] = next
  state.activeMonth = month
  saveState(state)
  return next
}

function submitReport(month) {
  const report = getReport(month)
  const validation = reportUtils.validateReport(report)
  if (!validation.valid) return { success: false, validation: validation }
  if (report.status !== 'draft' && report.status !== 'returned') {
    return { success: false, validation: validation, message: '当前状态不能提交' }
  }
  report.status = 'pending_confirmation'
  report.submittedAt = Date.now()
  report.returnReason = ''
  const saved = saveReport(report)
  return { success: true, report: saved, validation: validation }
}

function returnReport(month, reason) {
  const report = getReport(month)
  if (report.status !== 'pending_confirmation') throw new Error('只有待确认月报可以退回')
  report.status = 'returned'
  report.returnReason = String(reason || '').trim()
  report.returnedAt = Date.now()
  return saveReport(report)
}

function confirmReport(month) {
  const report = getReport(month)
  const validation = reportUtils.validateReport(report)
  if (!validation.valid) return { success: false, validation: validation }
  if (report.status !== 'pending_confirmation') {
    return { success: false, validation: validation, message: '只有待确认月报可以确认' }
  }
  report.status = 'confirmed'
  report.confirmedAt = Date.now()
  const saved = saveReport(report)
  return { success: true, report: saved, validation: validation }
}

function reopenReport(month) {
  const report = getReport(month)
  report.status = 'draft'
  report.confirmedAt = 0
  return saveReport(report)
}

function copyPreviousMonth(month) {
  const previousMonth = reportUtils.shiftMonth(month, -1)
  const previous = getReport(previousMonth)
  if (!hasReport(previousMonth)) return null
  const copied = reportUtils.createEmptyReport(month)
  copied.balance = Object.assign({}, previous.balance)
  copied.profit = Object.assign({}, previous.profit)
  return saveReport(copied)
}

function hasReport(month) {
  const state = getState()
  return Boolean(state.reports[month])
}

function listReports() {
  const state = getState()
  return Object.keys(state.reports).sort().reverse().map(function (month) {
    return normalizeReport(state.reports[month], month)
  })
}

function clearReports() {
  const state = getState()
  state.reports = {}
  state.activeMonth = reportUtils.currentMonth()
  saveState(state)
}

function clearAll() {
  wx.removeStorageSync(STORAGE_KEY)
}

function exportData() {
  return JSON.stringify(getState(), null, 2)
}

function seedDemoData() {
  const state = getState()
  if (!state.company) {
    state.company = {
      id: 'demo_company',
      name: '柠月商贸有限公司',
      industry: '商贸零售',
      startMonth: reportUtils.shiftMonth(reportUtils.currentMonth(), -5),
      updatedAt: Date.now()
    }
  }

  const current = reportUtils.currentMonth()
  let retained = 8200000
  for (let index = 5; index >= 0; index--) {
    const month = reportUtils.shiftMonth(current, -index)
    const step = 5 - index
    const revenue = (180000 + step * 13500) * 100
    const cost = Math.round(revenue * (0.58 + (step % 2) * 0.02))
    const selling = (12000 + step * 800) * 100
    const admin = (18000 + step * 600) * 100
    const finance = (1800 + step * 150) * 100
    const taxes = Math.round(revenue * 0.012)
    const incomeTax = Math.round((revenue - cost - selling - admin - finance - taxes) * 0.1)
    const report = reportUtils.createEmptyReport(month)
    report.profit = Object.assign(report.profit, {
      mainRevenue: revenue,
      mainCost: cost,
      taxesAndSurcharges: taxes,
      sellingExpenses: selling,
      adminExpenses: admin,
      financeExpenses: finance,
      otherIncome: step % 3 === 0 ? 300000 : 0,
      incomeTax: Math.max(incomeTax, 0)
    })
    const netProfit = reportUtils.calculateProfit(report.profit).netProfit
    retained += netProfit
    const cash = (98000 + step * 11000) * 100
    const receivable = (62000 + step * 7000) * 100
    const inventory = (128000 + step * 5000) * 100
    const otherCurrent = 1800000
    const fixed = 26000000 - step * 1200000
    const otherNonCurrent = 6000000
    const assets = cash + receivable + inventory + otherCurrent + fixed + otherNonCurrent
    const shortLoans = 6000000
    const payable = (72000 + step * 3000) * 100
    const taxesPayable = 900000
    const otherCurrentLiabilities = 2200000
    const longLoans = 8000000
    const otherNonCurrentLiabilities = 1500000
    const liabilities = shortLoans + payable + taxesPayable + otherCurrentLiabilities + longLoans + otherNonCurrentLiabilities
    const paidInCapital = 20000000
    const otherEquity = 3000000
    retained = assets - liabilities - paidInCapital - otherEquity
    report.balance = Object.assign(report.balance, {
      cash: cash,
      accountsReceivable: receivable,
      inventory: inventory,
      otherCurrentAssets: otherCurrent,
      fixedAssets: fixed,
      otherNonCurrentAssets: otherNonCurrent,
      shortTermLoans: shortLoans,
      accountsPayable: payable,
      taxesPayable: taxesPayable,
      otherCurrentLiabilities: otherCurrentLiabilities,
      longTermLoans: longLoans,
      otherNonCurrentLiabilities: otherNonCurrentLiabilities,
      paidInCapital: paidInCapital,
      retainedEarnings: retained,
      otherEquity: otherEquity
    })
    report.status = index === 0 ? 'draft' : 'confirmed'
    report.confirmedAt = report.status === 'confirmed' ? Date.now() : 0
    state.reports[month] = report
  }
  state.activeMonth = current
  saveState(state)
  return state
}

module.exports = {
  getState: getState,
  getUser: getUser,
  cacheUser: cacheUser,
  saveUserProfile: saveUserProfile,
  getSession: getSession,
  listMembers: listMembers,
  getCompany: getCompany,
  setCompany: setCompany,
  cacheCompany: cacheCompany,
  cacheReport: cacheReport,
  cacheReports: cacheReports,
  getActiveMonth: getActiveMonth,
  setActiveMonth: setActiveMonth,
  getReport: getReport,
  saveReport: saveReport,
  submitReport: submitReport,
  returnReport: returnReport,
  confirmReport: confirmReport,
  reopenReport: reopenReport,
  copyPreviousMonth: copyPreviousMonth,
  hasReport: hasReport,
  listReports: listReports,
  clearReports: clearReports,
  clearAll: clearAll,
  exportData: exportData,
  seedDemoData: seedDemoData
}
