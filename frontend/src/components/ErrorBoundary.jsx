import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('UI boundary caught an error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="page-stack error-boundary" role="alert">
        <div className="notice notice-danger">
          <b>Этот раздел не удалось отобразить.</b>
          <p>Данные не потеряны. Обновите страницу или вернитесь к списку чатов.</p>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => this.setState({ hasError: false, error: null })}>
            Повторить
          </button>
        </div>
      </div>
    )
  }
}
