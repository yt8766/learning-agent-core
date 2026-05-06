import { createRoot } from 'react-dom/client';

import './styles/tailwind.css';
import '@ant-design/x-markdown/themes/light.css';
import '@ant-design/x-markdown/themes/dark.css';
import 'antd/dist/reset.css';
import './styles/index.css';
import App from './app/app';

createRoot(document.getElementById('root')!).render(<App />);
