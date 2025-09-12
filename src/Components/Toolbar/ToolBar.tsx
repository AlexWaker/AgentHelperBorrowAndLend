import SuiConnectButton from './ConnectButton'
import { ToolBarContainer, WelcomeText, TypingCursor } from './styled'
import React from 'react'

const ToolBar = () => {
  const fullText = '欢迎来到Navi Protocol的Agent世界'
  const [displayed, setDisplayed] = React.useState('')
  const [finished, setFinished] = React.useState(false)

  React.useEffect(() => {
    let i = 0
    const speed = 70 // 每个字符间隔 ms
    const id = setInterval(() => {
      i++
      setDisplayed(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(id)
        setFinished(true)
      }
    }, speed)
    return () => clearInterval(id)
  }, [])

  return (
    <ToolBarContainer>
      <WelcomeText aria-label={fullText}>
        {displayed}
        {!finished && <TypingCursor />}
      </WelcomeText>
      <SuiConnectButton />
    </ToolBarContainer>
  )
}

export default ToolBar