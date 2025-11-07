import { provide, reactive } from 'vue'
import { INJECTION_KEY } from '@/constants/injection-key'
import { fetchLoginUser } from '@/services/bilibili-service';

function useProvideLoginOptions() {


    const login_user = reactive({
        id: 0,
        user_name: '',
        avatar: '',
    });


    provide(INJECTION_KEY.LOGIN_USER, login_user)

    //检测用户是否登陆
    setLoginUserInfo(login_user);
}

/**
 * 请求登陆用户信息
 * @param {object} login_user
 */
async function setLoginUserInfo(login_user) {
    try {
        const user = await fetchLoginUser();
        login_user.id = user.id || 0;
        login_user.user_name = user.user_name || '';
        login_user.avatar = user.avatar || '';
    } catch (error) {
        console.warn('获取登陆信息失败', error);
        login_user.id = 0;
        login_user.user_name = '';
        login_user.avatar = '';
    }
}



export { useProvideLoginOptions, setLoginUserInfo }
