import React, { FC, useState } from 'react';
import {
  ThemeProvider,
  ThemeToggle,
  Button,
  Input,
  Card,
} from '@applypilot/ui';

export const AppContent: FC = () => {
  const [inputValue, setInputValue] = useState('My Automation Workspace');
  const [showError, setShowError] = useState(false);

  const toggleInputError = () => {
    setShowError((current) => !current);
  };

  return (
    <div className="demo-layout">
      <header className="demo-header">
        <h1 className="demo-header__title">ApplyPilot</h1>
        <ThemeToggle />
      </header>

      <main>
        <Card
          header={
            <div className="demo-status" id="dev-status-indicator" role="status">
              <span className="demo-status__dot" aria-hidden="true" />
              <span>Desktop application initialized</span>
            </div>
          }
        >
          <Input
            id="workspace-input"
            label="Workspace Configuration"
            placeholder="Enter workspace name"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            error={showError ? 'Workspace name cannot be empty or invalid' : undefined}
            helperText="Shared design system token and component verification"
          />

          <div className="demo-actions">
            <Button variant="primary">
              Primary Action
            </Button>
            <Button variant="secondary" onClick={toggleInputError}>
              {showError ? 'Clear Input Error' : 'Trigger Input Error'}
            </Button>
            <Button variant="secondary" disabled>
              Disabled Action
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export const App: FC = () => {
  return (
    <ThemeProvider defaultTheme="dark">
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
