import { useQuery } from "@tanstack/react-query";
import { client } from "../client";
import { CommonButton } from "../components/common/CommonButton";
import { setLocalItem } from "../utils/LocalStorage";
import { useStream } from "../hook/useStream";

export const AnonoymousLoginPage = () => {
  const { refetch } = useQuery({
    queryKey: ["anonymousLogin"],
    queryFn: async () => {
      const token = await client["authentication:anonymousLogin"]({});

      setLocalItem("@writing-tool/userToken", token);

      return token;
    },
    enabled: false,
  });

  const { data: animalsData, restart } = useStream(async () => {
    return client.streamTestData({});
  }, true); // false if not auto start

  const handleStart = async () => {
    await refetch();

    window.location.href = "/intro";
  };

  return (
    <div className="relative w-full h-full p-5 flex flex-col justify-end items-center overflow-hidden pt-[env(safe-area-inset-top)]">
      <div>Animals list</div>
      {animalsData?.animals?.map((animal: string) => {
        return <div className="text-white">{animal}</div>;
      })}
      <CommonButton
        className="w-[80%] py-4 rounded-full montserrat-semibold"
        text={"Login"}
        onClick={async () => await handleStart()}
      />

      <CommonButton
        className="w-[80%] py-4 rounded-full montserrat-semibold"
        text={"Stream another list"}
        onClick={async () => await restart()}
      />
    </div>
  );
};
