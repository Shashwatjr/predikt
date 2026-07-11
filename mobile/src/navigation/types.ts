export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
  Home: { replayOnboarding?: boolean } | undefined;
  CreateRoom: undefined;
  RoomCreated: { room: any };
  JoinRoom: { joinCode?: string } | undefined;
  Prediction: { roomId: string; room: any };
  LiveRoom: { roomId: string; isCreator: boolean };
  Result: { roomId: string; result?: any };
  Leaderboard: undefined;
  Profile: undefined;
  Notifications: undefined;
  Help: { allowReplayTour?: boolean } | undefined;
  Legal: { slug: string; title: string };
};
