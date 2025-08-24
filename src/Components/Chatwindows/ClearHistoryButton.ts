import React from 'react';
import { ClearButton } from './styled';

type ClearHistoryButtonProps = {
  onClear: () => void;
  disabled?: boolean;
};

// 使用 .ts 文件实现 React 组件（不使用 JSX）
export default function ClearHistoryButton(
  { onClear, disabled = false }: ClearHistoryButtonProps
): React.ReactElement {
  return React.createElement(
    ClearButton,
    {
      onClick: onClear,
      disabled,
      title: '清空聊天历史',
    },
    React.createElement('span', { style: { fontSize: 14 } as React.CSSProperties }, '🧹'),
    React.createElement('span', null, '清空')
  );
}
