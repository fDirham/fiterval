import React from 'react';
import {
    StatusBar,
    View,
} from 'react-native';

import Timer from './components/main/Timer'

const App: () => React$Node = () => {
  return (
    <View style={{flex: 1, justifyContent: "flex-start"}}>
      <StatusBar barStyle="dark-content" />
      <Timer />
    </View>
  );
};

export default App;
