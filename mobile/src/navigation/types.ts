export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  Home: { replayOnboarding?: boolean; replayDemoPicker?: boolean } | undefined;
  CreateRoom:
    | {
        presetCategory?: 'arrival_time' | 'food_eta' | 'open_prediction' | 'gym_habit' | 'sports_prediction';
        presetTemplate?: 'sports' | 'delivery' | 'free_play';
      }
    | undefined;
  RoomCreated: { room: any };
  JoinRoom: { joinCode?: string } | undefined;
  Prediction: { roomId: string; room: any; editPredictionId?: string };
  LiveRoom: { roomId: string; isCreator: boolean; justPredicted?: boolean };
  Result: { roomId: string; result?: any };
  Leaderboard: undefined;
  Profile: undefined;
  Notifications: undefined;
  Help: { allowReplayTour?: boolean } | undefined;
  Legal: { slug: string; title: string };
};
