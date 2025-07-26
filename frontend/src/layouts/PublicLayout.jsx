import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import { Box } from '@mui/material';

function PublicLayout() {
  return (
    <Box>
      <Header />
      <main>
        <Outlet />
      </main>
    </Box>
  );
}

export default PublicLayout;