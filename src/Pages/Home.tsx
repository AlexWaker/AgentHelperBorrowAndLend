import React from 'react';
import ToolBar from '../Components/Toolbar/ToolBar'
import ChatWindow from '../Components/Chatwindows/ChatWindow';
import {AppContainer, ToolbarWrapper, ChatWrapper} from './styled';

const Home: React.FC = () => {
  return (
    <AppContainer>
      {/* 顶部工具栏 */}
      <ToolbarWrapper>
        <ToolBar />
      </ToolbarWrapper>
      
      {/* 聊天界面 */}
      <ChatWrapper>
        <ChatWindow />
      </ChatWrapper>
    </AppContainer>
  );
};

export default Home;
