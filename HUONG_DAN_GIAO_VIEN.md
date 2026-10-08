# Sử dụng cổng học chung

Cổng: https://vuongndlst.github.io/lsts-learning/ . Bốn website cũ tiếp tục hoạt động. Cổng mới dành cho thí điểm song song, chưa tự chuyển học sinh, lịch hoặc tiến độ cũ.

## Khách và tài khoản

Chọn **Khám phá khóa học** để tự học không cần đăng nhập. Tiến độ khách lưu bằng localStorage trên trình duyệt đang dùng, có thể tải bản sao. Chế độ khách mở điều hướng học bù nhưng vẫn yêu cầu làm checkpoint để hoàn thành. Dữ liệu khách không tự nhập vào tài khoản hoặc kết quả lớp.

Đăng nhập để tham gia lớp bằng mã và lưu vào tài khoản. Mã học sinh gồm đúng 7 chữ số, giữ số 0 đầu. Email tự tạo theo mã học sinh. Không xác nhận email. Thông tin họ tên, lớp học thuật, family sửa trong hồ sơ. Đăng nhập được giữ qua các lần mở trình duyệt.

## Mở lớp đầu tiên

1. Đăng nhập bằng email trường. Giáo viên dùng mật khẩu tạm phải đổi mật khẩu trước khi vào dashboard.
2. Kiểm tra lớp được phân công. Có sẵn 16 lớp ở trạng thái **Chuẩn bị**: Vương 9, cô Hân 5, thầy Thịnh 2. Bốn lớp ML đều học Level 1.
3. Trong **Cài đặt**, mở nhận học sinh và sao chép mã lớp. Mã chỉ hiện khi tạo hoặc đổi; cần lưu riêng trước khi đóng hộp thoại.
4. Trong **Lịch học**, chọn lên lịch và giao bài, chọn bài, ngày giờ, thời lượng, phòng. Chọn cả lớp hoặc một nhóm, một buổi hoặc nhiều tuần, bỏ ngày nghỉ. Xem trước rồi xác nhận.
5. Học sinh đăng nhập, nhập mã lớp. Lớp học trên web độc lập với lớp học thuật trong hồ sơ.
6. Bài mở từ giờ đã chọn. Trong buổi học giữ checkpoint theo chặng; sau buổi học mở điều hướng tự học để học sinh vắng có thể học bù. Mở điều hướng không đánh dấu hoàn thành.

Giáo viên tạo thêm lớp bằng tên tự đặt, chọn khóa, năm học và phiên bản. Admin thêm giáo viên vào khóa; giáo viên hỗ trợ cấp mật khẩu tạm cho học sinh thuộc lớp mình. Tiến độ tự học dùng để đối chiếu bài làm, chưa phải điểm chính thức.

## Cập nhật học liệu

Giữ nguyên nguồn chính thức ở từng thư mục khóa. Sửa nội dung, hình và video trong script sinh bài; không sửa tay JSON đã sinh hoặc nội dung block đang dùng. Slide giảng dạy và nguồn web là hai tài liệu riêng: sửa PPTX không tự sửa bài web.

Pipeline nội bộ tại thư mục `LSTS_Learning`: chạy `scripts/build_content.cjs` để đóng gói bốn khóa, rồi `scripts/ml_activities.py` để bổ sung đầy đủ thực hành và notebook ML bản học sinh. Kiểm tra bản đóng gói trong `_Private/content-bundle.json`, thử chức năng và kiểm tra nguồn video trước khi phát hành.

Phát hành riêng khóa đã sửa bằng `scripts/provision_portal.py content <số phiên bản mới> <course_id>`. Số mới phải lớn hơn phiên bản hiện tại của khóa: bản đầu SQL/Python/C++ là 1, ML đầy đủ thực hành là 3. Không dùng lại số phiên bản đã phát hành.

Trong lớp, chọn phiên bản mới tại **Cài đặt** để dùng cho bài giao tiếp theo. Bài đã giao giữ nội dung và tiến độ cũ. Khách sẽ đọc phiên bản mới nhất, tiến độ khách tách theo phiên bản. Cập nhật nội dung không cần phát hành lại giao diện; thay đổi runtime/giao diện mới cần build và đẩy repository cổng.

Đợt này không sửa nguồn hoặc URL các website đang dạy. Trước khi chuyển một lớp đang học, đối chiếu roster và tiến độ tại web cũ, chọn buổi thí điểm và giữ lối quay lại web cũ. Không gộp dữ liệu localStorage cũ vào tiến độ lớp mới khi chưa có ánh xạ danh tính học sinh.

## Năm học sau

Tạo lớp mới, chọn năm học mới và học liệu phù hợp. Lưu trữ lớp cũ để xem lại tiến độ. Học sinh giữ cùng tài khoản và có thể tham gia nhiều khóa qua các năm.

## Cấu hình riêng

Token quản trị nằm trong `.env` của Grade 11 - MOET, khóa `db-token`. Không đưa `.env`, `_Private`, thông tin mật khẩu hoặc backup vào GitHub. Mật khẩu tạm giáo viên nằm trong `_Private/giao-vien-2026-2027.md` và cung cấp riêng cho đúng người. Không đổi mật khẩu admin khi cập nhật nguồn hoặc phát hành lại.

Migration trong thư mục Supabase đã được áp dụng bằng Management API. Cần đối chiếu nhật ký trước khi chạy CLI `db push`. Edge Function cổng sử dụng `verify_jwt:true`; không tắt xác thực để xử lý lỗi giao diện.
