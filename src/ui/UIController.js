import { DEFAULT_ROUTINE } from '../state.js'

const select = selector => document.querySelector(selector)
const selectAll = selector => [...document.querySelectorAll(selector)]

export class UIController {
  constructor(store) {
    this.store = store
    this.game = null
    this.openSheet = null
    this.focusReturnTarget = null
    this.toastTimer = null
    this.elements = {
      app: select('#app'),
      introCopy: select('#introCopy'),
      touchGuide: select('#touchGuide'),
      hud: select('#hud'),
      petNameTitle: select('#petNameTitle'),
      dayLabel: select('#dayLabel'),
      worldHint: select('#worldHint'),
      toast: select('#toast'),
      backdrop: select('#backdrop'),
      namePanel: select('#namePanel'),
      petNameInput: select('#petNameInput'),
      startLife: select('#startLife'),
      foodSheet: select('#foodSheet'),
      memorySheet: select('#memorySheet'),
      memoryList: select('#memoryList'),
      creatorSheet: select('#creatorSheet'),
      memoryButton: select('#memoryButton'),
      creatorButton: select('#creatorButton'),
      debugTime: select('#debugTime'),
      debugState: select('#debugState'),
      settingsBreakfast: select('#settingsBreakfast'),
      settingsDinner: select('#settingsDinner'),
      settingsWake: select('#settingsWake'),
      settingsBedtime: select('#settingsBedtime'),
      saveRoutine: select('#saveRoutine'),
      toggleDebugScene: select('#toggleDebugScene'),
      resetPreview: select('#resetPreview'),
      runtimeError: select('#runtimeError'),
    }
    this.bind()
    this.unsubscribe = store.subscribe(snapshot => this.render(snapshot), { immediate: true })
  }

  bindGame(game) {
    this.game = game
  }

  bind() {
    const { elements: e } = this
    e.startLife.addEventListener('click', () => {
      const name = e.petNameInput.value.trim() || 'こむぎ'
      this.store.begin(name, DEFAULT_ROUTINE)
      this.close()
      this.showRoom()
      this.game?.scene.stop('FirstMeetingScene')
      this.game?.scene.start('RoomScene')
      this.toast(`${name}との暮らしが始まりました。`, 2400)
    })
    e.petNameInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') e.startLife.click()
    })

    e.memoryButton.addEventListener('click', () => {
      this.renderMemories()
      this.open(e.memorySheet)
    })
    e.creatorButton.addEventListener('click', () => this.open(e.creatorSheet))
    e.backdrop.addEventListener('click', () => {
      if (this.openSheet !== e.namePanel) this.close()
    })
    selectAll('[data-close]').forEach(button => button.addEventListener('click', () => this.close()))

    selectAll('[data-food]').forEach(button => button.addEventListener('click', () => {
      this.store.feed(button.dataset.food)
      this.close()
      this.toast(button.dataset.food === 'treat' ? 'おやつを少しだけ置きました。' : '食器へごはんを置きました。')
    }))

    selectAll('[data-time]').forEach(button => button.addEventListener('click', () => {
      this.store.advance(Number(button.dataset.time))
      this.close()
      this.toast('検証用の時刻を進めました。')
    }))

    selectAll('[data-debug]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.debug
      if (action === 'hungry') this.store.toggleHunger()
      if (action === 'sleep') this.store.toggleSleep()
      if (action === 'reset-time') this.store.useActualTime()
      this.close()
    }))

    e.saveRoutine.addEventListener('click', () => {
      this.store.updateRoutine({
        breakfast: e.settingsBreakfast.value,
        dinner: e.settingsDinner.value,
        wake: e.settingsWake.value,
        bedtime: e.settingsBedtime.value,
      })
      this.close()
      this.toast('生活時間を変更しました。')
    })

    e.toggleDebugScene.addEventListener('click', () => {
      if (!this.game) return
      const debug = this.game.scene.getScene('DebugScene')
      if (debug?.scene.isActive()) debug.scene.stop()
      else this.game.scene.run('DebugScene')
      this.close()
    })

    e.resetPreview.addEventListener('click', () => {
      if (!confirm('確認データを削除して、最初の出会いからやり直しますか？')) return
      this.store.reset()
      location.reload()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.store.markSeen()
      else this.store.refresh()
    })
    window.addEventListener('pagehide', () => this.store.markSeen())
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.openSheet) {
        if (this.openSheet === e.namePanel) return
        event.preventDefault()
        this.close()
      }
      if (event.key === 'Tab' && this.openSheet) this.trapFocus(event)
    })
  }

  showFirstMeeting() {
    const { elements: e } = this
    e.app.dataset.mode = 'first-meeting'
    e.introCopy.hidden = false
    e.touchGuide.hidden = false
    e.hud.hidden = true
    e.worldHint.hidden = true
  }

  showNamePanel() {
    const { elements: e } = this
    e.touchGuide.hidden = true
    this.open(e.namePanel)
    setTimeout(() => e.petNameInput.focus({ preventScroll: true }), 180)
  }

  showRoom() {
    const { elements: e } = this
    e.app.dataset.mode = 'room'
    e.introCopy.hidden = true
    e.touchGuide.hidden = true
    e.hud.hidden = false
    e.worldHint.hidden = false
  }

  showRuntimeError(message = '') {
    const { elements: e } = this
    e.app.dataset.mode = 'error'
    e.runtimeError.hidden = false
    if (message) e.runtimeError.querySelector('p:last-child').textContent = message
  }

  openFood() {
    this.open(this.elements.foodSheet)
  }

  open(sheet) {
    this.close(false)
    this.focusReturnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null
    this.openSheet = sheet
    this.elements.backdrop.hidden = false
    sheet.hidden = false
    this.updateExpandedState(sheet, true)
    requestAnimationFrame(() => {
      if (sheet === this.elements.namePanel) return
      const firstControl = this.getFocusable(sheet)[0]
      firstControl?.focus({ preventScroll: true })
    })
  }

  close(restoreFocus = true) {
    const sheet = this.openSheet
    if (sheet) {
      sheet.hidden = true
      this.updateExpandedState(sheet, false)
    }
    this.openSheet = null
    this.elements.backdrop.hidden = true
    if (restoreFocus && this.focusReturnTarget?.isConnected) {
      this.focusReturnTarget.focus({ preventScroll: true })
    }
    this.focusReturnTarget = null
  }

  getFocusable(root) {
    return selectAll('button:not([disabled]), input:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])')
      .filter(element => root.contains(element) && !element.hidden && element.getClientRects().length > 0)
  }

  trapFocus(event) {
    const controls = this.getFocusable(this.openSheet)
    if (!controls.length) return
    const first = controls[0]
    const last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  updateExpandedState(sheet, expanded) {
    if (sheet === this.elements.memorySheet) this.elements.memoryButton.setAttribute('aria-expanded', String(expanded))
    if (sheet === this.elements.creatorSheet) this.elements.creatorButton.setAttribute('aria-expanded', String(expanded))
  }

  toast(message, duration = 1900) {
    clearTimeout(this.toastTimer)
    this.elements.toast.textContent = message
    this.elements.toast.hidden = false
    this.toastTimer = setTimeout(() => { this.elements.toast.hidden = true }, duration)
  }

  renderMemories() {
    const list = this.elements.memoryList
    list.replaceChildren()
    const memories = this.store.getState().memories || []
    if (!memories.length) {
      const empty = document.createElement('article')
      empty.className = 'memory-item'
      empty.textContent = 'まだ記録はありません。'
      list.append(empty)
      return
    }

    for (const memory of memories.slice(0, 16)) {
      const item = document.createElement('article')
      const title = document.createElement('strong')
      const body = document.createElement('p')
      item.className = 'memory-item'
      title.textContent = memory.title
      body.textContent = memory.body
      item.append(title, body)
      list.append(item)
    }
  }

  render(snapshot) {
    const { elements: e } = this
    e.app.dataset.phase = snapshot.time.phase
    e.petNameTitle.textContent = snapshot.state.petName
    e.dayLabel.textContent = `一緒に ${snapshot.time.day}日目`
    e.debugTime.textContent = new Date(snapshot.time.now).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    e.debugState.textContent = snapshot.ephemeral ? 'QA一時状態' : snapshot.saveHealthy ? '保存 正常' : '保存不可'
    e.settingsBreakfast.value = snapshot.state.routine.breakfast
    e.settingsDinner.value = snapshot.state.routine.dinner
    e.settingsWake.value = snapshot.state.routine.wake
    e.settingsBedtime.value = snapshot.state.routine.bedtime
  }
}

export default UIController
