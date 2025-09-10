import SuiConnectButton from './ConnectButton'
import { ToolBarContainer, WelcomeText } from './styled'

const ToolBar = () => {
  return (
    <ToolBarContainer>
      <WelcomeText>
        欢迎来到Navi Protocol的Agent世界
      </WelcomeText>
      
      <SuiConnectButton />
    </ToolBarContainer>
  );
};

export default ToolBar