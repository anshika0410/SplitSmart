export const colors = {
  light: {
    background: '#F8F9FA',
    card: '#FFFFFF',
    text: '#2D3436',
    textSecondary: '#636E72',
    border: '#DFE6E9',
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    success: '#00B894',
    successLight: 'rgba(0,184,148,0.2)',
    danger: '#FF7675',
    dangerLight: 'rgba(255,118,117,0.2)',
    surface: '#F1F2F6', // For small internal cards or items
    inputBackground: '#F1F2F6',
    overlay: 'rgba(0,0,0,0.5)',
    shadow: '#B2BEC3'
  },
  dark: {
    background: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#A0A0A0',
    border: '#3D3D3D',
    primary: '#6C5CE7',
    primaryLight: '#A29BFE',
    success: '#00B894',
    successLight: 'rgba(0,184,148,0.2)',
    danger: '#FF7675',
    dangerLight: 'rgba(255,118,117,0.2)',
    surface: '#2D3436', // For small internal cards or items
    inputBackground: '#2D3436',
    overlay: 'rgba(0,0,0,0.7)',
    shadow: '#6C5CE7'
  }
};

export const getTheme = (isDarkMode: boolean) => {
  return isDarkMode ? colors.dark : colors.light;
};
