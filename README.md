# LSTS Learning

Cổng quản lý lớp và học tập chung cho C++ 8, Python 10, SQL 11 và Machine Learning Level 1 tại Đinh Thiện Lý.

## Chức năng

- Khám phá bốn khóa không cần đăng nhập. Chế độ khách lưu tiến độ, bài làm và lịch sử SQL trên cùng trình duyệt, tách riêng dữ liệu lớp. Xóa dữ liệu trình duyệt sẽ xóa tiến độ khách.
- Tài khoản học sinh bằng MSHS 7 chữ số, giữ số 0 đầu; email trường tự tạo; không cần xác nhận email. Hồ sơ sửa được và dùng chung các khóa.
- Dashboard giáo viên/admin; tạo lớp tự đặt tên, chọn khóa, năm học và phiên bản học liệu.
- Mã tham gia lớp 8 ký tự; mở/đóng nhận học sinh, đổi mã, tạm dừng/khôi phục thành viên, lưu trữ lớp.
- Lịch học và giao bài có bước xem trước; một buổi hoặc nhiều tuần, bỏ ngày nghỉ; giao cả lớp hoặc nhóm học sinh; lưu nháp/công bố và đổi lịch.
- Bài mở theo giờ Việt Nam. Sau buổi học, mở điều hướng học bù; checkpoint và nhiệm vụ vẫn được ghi riêng.
- Đăng nhập để tham gia lớp và lưu tiến độ Supabase theo tài khoản/lớp/bài/phiên bản. Có nháp khi mất mạng và đối chiếu xung đột. Chế độ khách không gửi bài làm lên Supabase.
- Admin cấp quyền khóa/thêm giáo viên; giáo viên hỗ trợ mật khẩu học sinh trong lớp mình. Mật khẩu tạm phải đổi trước khi học/dạy.
- Các engine được cô lập trong iframe, giữ tương tác, hình, sơ đồ, video và bộ chạy thực hành. ML có bài đọc, thế giới 3D và notebook bản học sinh.

## Phát triển và phát hành giao diện

Node.js 24. Cài thư viện bằng `npm ci`, chạy `npm run dev`, kiểm tra/build bằng `npm run build`. GitHub Actions phát hành `dist` lên GitHub Pages.

`src/config.json` chỉ chứa URL và khóa công khai của Supabase. Quyền được kiểm tra ở máy chủ; không đặt khóa quản trị, mật khẩu hoặc token trong repository.

## Học liệu và dữ liệu

Học liệu bài, hàm chấm theo bài và notebook học sinh nằm trong các block ở Supabase. API khách chỉ đọc học liệu đã công bố ở phiên bản mới nhất. Dữ liệu lớp, hồ sơ và tiến độ tài khoản vẫn được bảo vệ theo quyền. Repository này chứa giao diện và runtime chung. Nguồn bài chính thức được giáo viên quản lý qua pipeline riêng; không sửa trực tiếp các tệp runtime để đổi nội dung bài.

Phát hành học liệu thành phiên bản mới, sau đó chọn phiên bản cho lớp. Các bài đã giao giữ nguyên lesson ID và tiến độ. Mở năm mới bằng lớp mới, không tái sử dụng enrollment của năm trước.

Các migration trong `supabase/migrations` là nhật ký thay đổi đã kiểm thử. Dự án ban đầu được nâng cấp qua Management API; cần đối chiếu migration với trạng thái máy chủ trước khi sử dụng CLI `db push`, tránh chạy lại migration đã có. Các thao tác Auth có đặc quyền nằm trong Edge Functions, không nằm trong trình duyệt.

## Triển khai song song

Cổng mới chạy song song với các website cũ. Những lớp đang học chưa được tự chuyển roster, tiến độ hoặc lịch. Giáo viên cần đối chiếu lớp và chọn buổi thử trước khi mời học sinh chuyển sang cổng chung. Không đổi đường dẫn của website cũ trong đợt phát hành này.
