import React from 'react';
import {StatusBar, View} from 'react-native';

import Timer from './components/main/Timer';

const App: () => React$Node = () => {
  console.disableYellowBox = true;
  return (
    <View style={{flex: 1, justifyContent: 'flex-start'}}>
      <StatusBar barStyle="light-content" />
      <Timer />
    </View>
  );
};

export default App;
