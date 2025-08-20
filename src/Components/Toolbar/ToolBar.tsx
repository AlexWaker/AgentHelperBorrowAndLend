import SuiConnectButton from './ConnectButton'
import { ToolBarContainer, WelcomeText } from './styled'

const ToolBar = () => {
  return (
    <ToolBarContainer>
      <WelcomeText>
        欢迎
      </WelcomeText>
      
      <SuiConnectButton />
    </ToolBarContainer>
  );
};

export default ToolBar